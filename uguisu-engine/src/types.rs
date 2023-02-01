#[derive(PartialEq, Clone, Copy)]
pub(crate) enum Type {
    Void,
    Number,
    Bool,
    Function,
}

impl Type {
    pub(crate) fn get_name(&self) -> &str {
        match self {
            Type::Void => "void",
            Type::Number => "number",
            Type::Bool => "bool",
            Type::Function => "function",
        }
    }

    pub(crate) fn lookup_user_type(ty_identifier: &str) -> Result<Type, String> {
        match ty_identifier {
            "void" => Err("type `void` is invalid".to_owned()),
            "number" => Ok(Type::Number),
            "bool" => Ok(Type::Bool),
            _ => Err("unknown type name".to_owned()),
        }
    }

    pub(crate) fn assert(actual: Type, expected: Type) -> Result<Type, String> {
        if actual == expected {
            Ok(actual)
        } else {
            let message = format!("type mismatched. expected `{}`, found `{}`", expected.get_name(), actual.get_name());
            Err(message)
        }
    }
}
