recipes table:
| column_name | data_type |
| ------------------ | ------------------------ |
| id | uuid |
| title | text |
| description | text |
| source_url | text |
| image_url | text |
| servings | integer |
| prep_time_minutes | integer |
| cook_time_minutes | integer |
| ingredients | jsonb |
| instructions | jsonb |
| cuisines | ARRAY |
| meal_types | ARRAY |
| tags | ARRAY |
| effort_level | integer |
| nutrition | jsonb |
| notes | text |
| created_by | uuid |
| is_public | boolean |
| publish_date | timestamp with time zone |
| created_at | timestamp with time zone |
| updated_at | timestamp with time zone |
| embedding | USER-DEFINED |
| health_score | integer |
| cooking_method | text |
| total_time_minutes | integer |
| yield_text | text |
| suitable_for_diet | ARRAY |
| author | text |
| publisher_website | text |

ingredients table:
| column_name | data_type |
| ------------------ | ------------------------ |
| id | uuid |
| name | text |
| category | text |
| alternatives | ARRAY |
| nutrition_per_100g | jsonb |
| created_at | timestamp with time zone |
| embeddings | USER-DEFINED |
| clean_name | text |
| quantity | text |
| unit | text |
| notes | text |
| embedding | USER-DEFINED |
