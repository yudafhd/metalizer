use serde_json::{json, Value};

pub fn metadata_response_schema() -> Value {
    json!({
        "type": "OBJECT",
        "properties": {
            "assets": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "id": { "type": "STRING" },
                        "title": { "type": "STRING" },
                        "keywords": {
                            "type": "ARRAY",
                            "items": { "type": "STRING" }
                        },
                        "category": { "type": "INTEGER" }
                    },
                    "required": ["id", "title", "keywords", "category"]
                }
            }
        },
        "required": ["assets"]
    })
}
