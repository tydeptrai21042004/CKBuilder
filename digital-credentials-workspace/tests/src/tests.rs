use crate::Loader;
use ckb_testtool::{
    builtin::ALWAYS_SUCCESS,
    ckb_error::Error,
    ckb_types::{bytes::Bytes, core::TransactionBuilder, packed::*, prelude::*},
    context::Context,
};

const MAX_CYCLES: u64 = 10_000_000;
const RECORD_LENGTH: usize = 75;
const ACTIVE: u8 = 0;
const REVOKED: u8 = 1;

const ERR_INVALID_GROUP_CELL_COUNT: i8 = 6;
const ERR_DESTRUCTION_FORBIDDEN: i8 = 7;
const ERR_INVALID_DATA_LENGTH: i8 = 8;
const ERR_INVALID_VERSION: i8 = 9;
const ERR_INVALID_STATUS: i8 = 10;
const ERR_ISSUER_MISMATCH: i8 = 11;
const ERR_UNAUTHORIZED: i8 = 12;
const ERR_INVALID_INITIAL_STATE: i8 = 13;
const ERR_CREDENTIAL_ID_CHANGED: i8 = 14;
const ERR_INVALID_STATE_TRANSITION: i8 = 15;
const ERR_REASON_MISSING: i8 = 16;
const ERR_TIMESTAMP_MISSING: i8 = 17;
const ERR_IMMUTABLE_FIELD_CHANGED: i8 = 18;
const ERR_OUTPUT_LOCK_MISMATCH: i8 = 19;

struct Setup {
    context: Context,
    contract_dep: CellDep,
    type_script: Script,
    issuer_lock_dep: CellDep,
    issuer_lock: Script,
    other_lock: Script,
    issuer_hash: [u8; 32],
}

fn setup() -> Setup {
    let mut context = Context::default();
    let contract_bin: Bytes = Loader::default().load_binary("credential-revocation");
    let contract_out_point = context.deploy_cell(contract_bin);
    let contract_dep = CellDep::new_builder()
        .out_point(contract_out_point.clone())
        .build();

    let always_success_out_point = context.deploy_cell(ALWAYS_SUCCESS.clone());
    let issuer_lock = context
        .build_script(&always_success_out_point, Bytes::from(vec![1]))
        .expect("issuer lock");
    let issuer_lock_dep = CellDep::new_builder()
        .out_point(always_success_out_point.clone())
        .build();
    let issuer_hash_bytes = issuer_lock.calc_script_hash().as_bytes();
    let mut issuer_hash = [0u8; 32];
    issuer_hash.copy_from_slice(&issuer_hash_bytes[..]);

    let other_lock = context
        .build_script(&always_success_out_point, Bytes::from(vec![2]))
        .expect("other lock");

    let type_script = context
        .build_script(&contract_out_point, Bytes::from(issuer_hash.to_vec()))
        .expect("type script");

    Setup {
        context,
        contract_dep,
        type_script,
        issuer_lock_dep,
        issuer_lock,
        other_lock,
        issuer_hash,
    }
}

fn record(
    issuer_hash: [u8; 32],
    credential_byte: u8,
    status: u8,
    reason_code: u8,
    revoked_at: u64,
) -> Bytes {
    let mut data = vec![0u8; RECORD_LENGTH];
    data[0] = 1;
    data[1] = status;
    data[2..34].copy_from_slice(&[credential_byte; 32]);
    data[34..66].copy_from_slice(&issuer_hash);
    data[66] = reason_code;
    data[67..75].copy_from_slice(&revoked_at.to_le_bytes());
    Bytes::from(data)
}

fn input_cell(
    context: &mut Context,
    lock: Script,
    type_script: Option<Script>,
    data: Bytes,
) -> CellInput {
    let builder = CellOutput::new_builder()
        .capacity(1000u64.pack())
        .lock(lock);
    let output = match type_script {
        Some(script) => builder.type_(Some(script).pack()).build(),
        None => builder.build(),
    };
    let out_point = context.create_cell(output, data);
    CellInput::new_builder().previous_output(out_point).build()
}

fn output_cell(lock: Script, type_script: Option<Script>) -> CellOutput {
    let builder = CellOutput::new_builder()
        .capacity(1000u64.pack())
        .lock(lock);
    match type_script {
        Some(script) => builder.type_(Some(script).pack()).build(),
        None => builder.build(),
    }
}

fn verify_ok(
    mut setup: Setup,
    inputs: Vec<CellInput>,
    outputs: Vec<CellOutput>,
    outputs_data: Vec<Bytes>,
) {
    let tx = TransactionBuilder::default()
        .cell_deps(vec![setup.contract_dep, setup.issuer_lock_dep])
        .inputs(inputs)
        .outputs(outputs)
        .outputs_data(outputs_data.pack())
        .build();
    let tx = setup.context.complete_tx(tx);
    setup
        .context
        .verify_tx(&tx, MAX_CYCLES)
        .expect("transaction should pass");
}

fn verify_error(
    mut setup: Setup,
    inputs: Vec<CellInput>,
    outputs: Vec<CellOutput>,
    outputs_data: Vec<Bytes>,
    expected_code: i8,
) {
    let tx = TransactionBuilder::default()
        .cell_deps(vec![setup.contract_dep, setup.issuer_lock_dep])
        .inputs(inputs)
        .outputs(outputs)
        .outputs_data(outputs_data.pack())
        .build();
    let tx = setup.context.complete_tx(tx);
    let error = setup.context.verify_tx(&tx, MAX_CYCLES).unwrap_err();
    assert_script_error(error, expected_code);
}

fn assert_script_error(error: Error, expected_code: i8) {
    let text = error.to_string();
    assert!(
        text.contains(&format!("error code {} ", expected_code)),
        "expected script error {}, actual error: {}",
        expected_code,
        text
    );
}

#[test]
fn create_active_record() {
    let mut s = setup();
    let auth_input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, ACTIVE, 0, 0);
    verify_ok(s, vec![auth_input], vec![output], vec![data]);
}

#[test]
fn revoke_active_record() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, REVOKED, 3, 1_752_452_400);
    verify_ok(s, vec![input], vec![output], vec![data]);
}

#[test]
fn reject_unauthorized_creation() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.other_lock.clone(), None, Bytes::new());
    let output = output_cell(s.other_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, ACTIVE, 0, 0);
    verify_error(s, vec![input], vec![output], vec![data], ERR_UNAUTHORIZED);
}

#[test]
fn reject_initial_revoked_state() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, REVOKED, 1, 100);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_INVALID_INITIAL_STATE,
    );
}

#[test]
fn reject_reactivation() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, REVOKED, 1, 100),
    );
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, ACTIVE, 0, 0);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_INVALID_STATE_TRANSITION,
    );
}

#[test]
fn reject_credential_id_change() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 8, REVOKED, 1, 100);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_CREDENTIAL_ID_CHANGED,
    );
}

#[test]
fn reject_record_destruction() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let unrelated_output = output_cell(s.issuer_lock.clone(), None);
    verify_error(
        s,
        vec![input],
        vec![unrelated_output],
        vec![Bytes::new()],
        ERR_DESTRUCTION_FORBIDDEN,
    );
}

#[test]
fn reject_invalid_data_length() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![Bytes::from(vec![0u8; 10])],
        ERR_INVALID_DATA_LENGTH,
    );
}

#[test]
fn reject_multiple_output_records() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output1 = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let output2 = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, ACTIVE, 0, 0);
    verify_error(
        s,
        vec![input],
        vec![output1, output2],
        vec![data.clone(), data],
        ERR_INVALID_GROUP_CELL_COUNT,
    );
}

#[test]
fn reject_missing_reason_code() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, REVOKED, 0, 100);
    verify_error(s, vec![input], vec![output], vec![data], ERR_REASON_MISSING);
}

#[test]
fn reject_missing_timestamp() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, REVOKED, 1, 0);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_TIMESTAMP_MISSING,
    );
}

#[test]
fn reject_invalid_version() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let mut data = record(s.issuer_hash, 7, ACTIVE, 0, 0).to_vec();
    data[0] = 2;
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![Bytes::from(data)],
        ERR_INVALID_VERSION,
    );
}

#[test]
fn reject_invalid_status() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let mut data = record(s.issuer_hash, 7, ACTIVE, 0, 0).to_vec();
    data[1] = 9;
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![Bytes::from(data)],
        ERR_INVALID_STATUS,
    );
}

#[test]
fn reject_record_issuer_mismatch() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record([9u8; 32], 7, ACTIVE, 0, 0);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_ISSUER_MISMATCH,
    );
}

#[test]
fn reject_creation_with_foreign_output_lock() {
    let mut s = setup();
    let input = input_cell(&mut s.context, s.issuer_lock.clone(), None, Bytes::new());
    let output = output_cell(s.other_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, ACTIVE, 0, 0);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_OUTPUT_LOCK_MISMATCH,
    );
}

#[test]
fn reject_update_that_changes_output_lock() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let output = output_cell(s.other_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, REVOKED, 1, 100);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_OUTPUT_LOCK_MISMATCH,
    );
}

#[test]
fn reject_multiple_input_records() {
    let mut s = setup();
    let input1 = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let input2 = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 8, ACTIVE, 0, 0),
    );
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record(s.issuer_hash, 7, REVOKED, 1, 100);
    verify_error(
        s,
        vec![input1, input2],
        vec![output],
        vec![data],
        ERR_INVALID_GROUP_CELL_COUNT,
    );
}

#[test]
fn reject_immutable_issuer_change_on_update() {
    let mut s = setup();
    let input = input_cell(
        &mut s.context,
        s.issuer_lock.clone(),
        Some(s.type_script.clone()),
        record(s.issuer_hash, 7, ACTIVE, 0, 0),
    );
    let output = output_cell(s.issuer_lock.clone(), Some(s.type_script.clone()));
    let data = record([9u8; 32], 7, REVOKED, 1, 100);
    verify_error(
        s,
        vec![input],
        vec![output],
        vec![data],
        ERR_IMMUTABLE_FIELD_CHANGED,
    );
}
