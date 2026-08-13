use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("File error: {0}")]
    File(#[from] io::Error),
    #[error("Image error: {0}")]
    Image(#[from] image::ImageError),
    #[error("Network error: {0}")]
    Network(String),
    #[error("Gemini API error ({status}): {message}")]
    Gemini { status: u16, message: String },
    #[error("Gemini response error: {0}")]
    GeminiResponse(String),
    #[error("CSV error: {0}")]
    Csv(#[from] csv::Error),
    #[error("Cancelled")]
    Cancelled,
    #[error("Internal error: {0}")]
    Internal(String),
}

pub type AppResult<T> = Result<T, AppError>;

pub fn command_error(error: AppError) -> String {
    error.to_string()
}
