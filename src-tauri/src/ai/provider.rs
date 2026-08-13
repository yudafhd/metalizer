use crate::errors::AppResult;
use crate::models::{GenerateMetadataRequest, MetadataGenerationResult};

pub trait MetadataProvider {
    fn provider_name(&self) -> &'static str;
    fn generate_metadata(
        &self,
        request: &GenerateMetadataRequest,
    ) -> impl std::future::Future<Output = AppResult<MetadataGenerationResult>> + Send;
}
