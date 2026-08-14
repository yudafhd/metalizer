use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Permintaan tidak valid: {0}")]
    InvalidRequest(String),
    #[error("Gagal membaca file: {0}")]
    File(#[from] io::Error),
    #[error("Gagal membaca gambar: {0}")]
    Image(#[from] image::ImageError),
    #[error("Gagal terhubung ke internet: {0}")]
    Network(String),
    #[error("Error Gemini ({status}): {message}")]
    Gemini { status: u16, message: String },
    #[error("Respons Gemini bermasalah: {0}")]
    GeminiResponse(String),
    #[error("Gagal membuat CSV: {0}")]
    Csv(#[from] csv::Error),
    #[error("Dibatalkan")]
    Cancelled,
}

pub type AppResult<T> = Result<T, AppError>;

pub fn command_error(error: AppError) -> String {
    error.to_string()
}
