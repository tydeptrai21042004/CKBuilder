use ckb_std::error::SysError;

#[repr(i8)]
#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    IndexOutOfBound = 1,
    ItemMissing = 2,
    LengthNotEnough = 3,
    Encoding = 4,
    InvalidArgsLength = 5,
    InvalidGroupCellCount = 6,
    RecordDestructionForbidden = 7,
    InvalidDataLength = 8,
    InvalidVersion = 9,
    InvalidStatus = 10,
    IssuerMismatch = 11,
    Unauthorized = 12,
    InvalidInitialState = 13,
    CredentialIdChanged = 14,
    InvalidStateTransition = 15,
    RevocationReasonMissing = 16,
    RevocationTimestampMissing = 17,
    ImmutableFieldChanged = 18,
    OutputLockMismatch = 19,
}

impl From<SysError> for Error {
    fn from(error: SysError) -> Self {
        match error {
            SysError::IndexOutOfBound => Self::IndexOutOfBound,
            SysError::ItemMissing => Self::ItemMissing,
            SysError::LengthNotEnough(_) => Self::LengthNotEnough,
            SysError::Encoding => Self::Encoding,
            SysError::Unknown(code) => panic!("unexpected CKB syscall error: {}", code),
            #[allow(unreachable_patterns)]
            _ => panic!("unexpected CKB syscall error"),
        }
    }
}
