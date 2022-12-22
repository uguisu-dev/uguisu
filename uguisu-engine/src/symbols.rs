#[derive(Debug, Clone)]
pub struct FuncSymbol {
    //pub name: String,
    pub param_names: Vec<String>,    // for each params
    pub param_types: Vec<ValueKind>, // for each params
    pub ret_kind: Option<ValueKind>,
    pub is_external: bool,
}

#[derive(Debug, Clone)]
pub enum ValueKind {
    Number,
}
