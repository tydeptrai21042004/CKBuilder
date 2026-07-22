#![cfg_attr(not(any(feature = "library", test)), no_std)]
#![cfg_attr(not(test), no_main)]

#[cfg(any(feature = "library", test))]
extern crate alloc;

mod error;

use ckb_std::{
    ckb_constants::Source,
    ckb_types::{bytes::Bytes, prelude::*},
    error::SysError,
    high_level::{load_cell_data, load_cell_lock_hash, load_script, QueryIter},
};
use error::Error;

#[cfg(not(any(feature = "library", test)))]
ckb_std::entry!(program_entry);
#[cfg(not(any(feature = "library", test)))]
ckb_std::default_alloc!(16384, 1258306, 64);

const RECORD_LENGTH: usize = 75;
const VERSION: u8 = 1;
const STATUS_ACTIVE: u8 = 0;
const STATUS_REVOKED: u8 = 1;

#[derive(Clone, Debug, PartialEq, Eq)]
struct RevocationRecord {
    version: u8,
    status: u8,
    credential_id: [u8; 32],
    issuer_lock_hash: [u8; 32],
    reason_code: u8,
    revoked_at: u64,
}

pub fn program_entry() -> i8 {
    match validate_transaction() {
        Ok(()) => 0,
        Err(error) => error as i8,
    }
}

fn validate_transaction() -> Result<(), Error> {
    let script = load_script()?;
    let args: Bytes = script.args().unpack();
    if args.len() != 32 {
        return Err(Error::InvalidArgsLength);
    }
    let mut issuer_hash = [0u8; 32];
    issuer_hash.copy_from_slice(&args[..]);

    let input_count = count_group_cells(Source::GroupInput)?;
    let output_count = count_group_cells(Source::GroupOutput)?;

    match (input_count, output_count) {
        (0, 1) => {
            ensure_authorized(&issuer_hash)?;
            ensure_group_lock(0, Source::GroupOutput, &issuer_hash)?;
            let output = load_record(0, Source::GroupOutput)?;
            validate_creation(&output, &issuer_hash)
        }
        (1, 1) => {
            ensure_authorized(&issuer_hash)?;
            ensure_group_lock(0, Source::GroupInput, &issuer_hash)?;
            ensure_group_lock(0, Source::GroupOutput, &issuer_hash)?;
            let input = load_record(0, Source::GroupInput)?;
            let output = load_record(0, Source::GroupOutput)?;
            validate_update(&input, &output, &issuer_hash)
        }
        (1, 0) => Err(Error::RecordDestructionForbidden),
        _ => Err(Error::InvalidGroupCellCount),
    }
}

fn count_group_cells(source: Source) -> Result<usize, Error> {
    let mut index = 0usize;
    loop {
        match load_cell_data(index, source) {
            Ok(_) => index += 1,
            Err(SysError::IndexOutOfBound) => return Ok(index),
            Err(error) => return Err(error.into()),
        }
    }
}

fn ensure_authorized(expected_issuer_lock_hash: &[u8; 32]) -> Result<(), Error> {
    let authorized = QueryIter::new(load_cell_lock_hash, Source::Input)
        .any(|actual_hash| actual_hash[..] == expected_issuer_lock_hash[..]);
    if authorized {
        Ok(())
    } else {
        Err(Error::Unauthorized)
    }
}

fn ensure_group_lock(
    index: usize,
    source: Source,
    expected_issuer_lock_hash: &[u8; 32],
) -> Result<(), Error> {
    let actual_hash = load_cell_lock_hash(index, source)?;
    if actual_hash[..] == expected_issuer_lock_hash[..] {
        Ok(())
    } else {
        Err(Error::OutputLockMismatch)
    }
}

fn load_record(index: usize, source: Source) -> Result<RevocationRecord, Error> {
    let data = load_cell_data(index, source)?;
    decode_record(&data)
}

fn decode_record(data: &[u8]) -> Result<RevocationRecord, Error> {
    if data.len() != RECORD_LENGTH {
        return Err(Error::InvalidDataLength);
    }

    let version = data[0];
    let status = data[1];
    let mut credential_id = [0u8; 32];
    credential_id.copy_from_slice(&data[2..34]);
    let mut issuer_lock_hash = [0u8; 32];
    issuer_lock_hash.copy_from_slice(&data[34..66]);
    let reason_code = data[66];
    let mut timestamp_bytes = [0u8; 8];
    timestamp_bytes.copy_from_slice(&data[67..75]);
    let revoked_at = u64::from_le_bytes(timestamp_bytes);

    Ok(RevocationRecord {
        version,
        status,
        credential_id,
        issuer_lock_hash,
        reason_code,
        revoked_at,
    })
}

fn validate_common(
    record: &RevocationRecord,
    expected_issuer_hash: &[u8; 32],
) -> Result<(), Error> {
    if record.version != VERSION {
        return Err(Error::InvalidVersion);
    }
    if record.status != STATUS_ACTIVE && record.status != STATUS_REVOKED {
        return Err(Error::InvalidStatus);
    }
    if &record.issuer_lock_hash != expected_issuer_hash {
        return Err(Error::IssuerMismatch);
    }
    Ok(())
}

fn validate_creation(
    record: &RevocationRecord,
    expected_issuer_hash: &[u8; 32],
) -> Result<(), Error> {
    validate_common(record, expected_issuer_hash)?;
    if record.status != STATUS_ACTIVE || record.reason_code != 0 || record.revoked_at != 0 {
        return Err(Error::InvalidInitialState);
    }
    Ok(())
}

fn validate_update(
    input: &RevocationRecord,
    output: &RevocationRecord,
    expected_issuer_hash: &[u8; 32],
) -> Result<(), Error> {
    validate_common(input, expected_issuer_hash)?;
    if input.version != output.version || input.issuer_lock_hash != output.issuer_lock_hash {
        return Err(Error::ImmutableFieldChanged);
    }
    validate_common(output, expected_issuer_hash)?;

    if input.credential_id != output.credential_id {
        return Err(Error::CredentialIdChanged);
    }
    if input.status != STATUS_ACTIVE || output.status != STATUS_REVOKED {
        return Err(Error::InvalidStateTransition);
    }
    if output.reason_code == 0 {
        return Err(Error::RevocationReasonMissing);
    }
    if output.revoked_at == 0 {
        return Err(Error::RevocationTimestampMissing);
    }
    Ok(())
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    fn record(status: u8, reason_code: u8, revoked_at: u64) -> RevocationRecord {
        RevocationRecord {
            version: VERSION,
            status,
            credential_id: [7u8; 32],
            issuer_lock_hash: [8u8; 32],
            reason_code,
            revoked_at,
        }
    }

    #[test]
    fn creation_requires_clean_active_state() {
        assert_eq!(
            validate_creation(&record(STATUS_ACTIVE, 0, 0), &[8u8; 32]),
            Ok(())
        );
        assert_eq!(
            validate_creation(&record(STATUS_REVOKED, 1, 1), &[8u8; 32]),
            Err(Error::InvalidInitialState)
        );
    }

    #[test]
    fn update_is_irreversible() {
        let active = record(STATUS_ACTIVE, 0, 0);
        let revoked = record(STATUS_REVOKED, 1, 100);
        assert_eq!(validate_update(&active, &revoked, &[8u8; 32]), Ok(()));
        assert_eq!(
            validate_update(&revoked, &active, &[8u8; 32]),
            Err(Error::InvalidStateTransition)
        );
    }

    #[test]
    fn common_validation_rejects_version_status_and_issuer() {
        let mut invalid_version = record(STATUS_ACTIVE, 0, 0);
        invalid_version.version = 2;
        assert_eq!(
            validate_creation(&invalid_version, &[8u8; 32]),
            Err(Error::InvalidVersion)
        );

        let invalid_status = record(9, 0, 0);
        assert_eq!(
            validate_creation(&invalid_status, &[8u8; 32]),
            Err(Error::InvalidStatus)
        );

        assert_eq!(
            validate_creation(&record(STATUS_ACTIVE, 0, 0), &[9u8; 32]),
            Err(Error::IssuerMismatch)
        );
    }

    #[test]
    fn update_rejects_changed_immutable_fields() {
        let active = record(STATUS_ACTIVE, 0, 0);
        let mut changed_issuer = record(STATUS_REVOKED, 1, 100);
        changed_issuer.issuer_lock_hash = [9u8; 32];
        assert_eq!(
            validate_update(&active, &changed_issuer, &[8u8; 32]),
            Err(Error::ImmutableFieldChanged)
        );

        let mut changed_version = record(STATUS_REVOKED, 1, 100);
        changed_version.version = 2;
        assert_eq!(
            validate_update(&active, &changed_version, &[8u8; 32]),
            Err(Error::ImmutableFieldChanged)
        );
    }

    #[test]
    fn update_requires_reason_and_timestamp() {
        let active = record(STATUS_ACTIVE, 0, 0);
        assert_eq!(
            validate_update(&active, &record(STATUS_REVOKED, 0, 100), &[8u8; 32]),
            Err(Error::RevocationReasonMissing)
        );
        assert_eq!(
            validate_update(&active, &record(STATUS_REVOKED, 1, 0), &[8u8; 32]),
            Err(Error::RevocationTimestampMissing)
        );
    }
}
