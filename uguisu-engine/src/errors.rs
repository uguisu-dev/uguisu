#[derive(Debug, Clone)]
pub struct CompileError {
    pub message: String,
}

impl CompileError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}
