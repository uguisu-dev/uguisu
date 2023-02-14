use std::collections::BTreeMap;
use std::time::SystemTime;
use crate::{RuntimeError, hir};
use crate::hir::Type;
use crate::hir_run::Value;

pub(crate) struct BuiltinInfo {
    pub name: String,
    pub params: Vec<Type>,
    pub ret_ty: Type,
}

impl BuiltinInfo {
    pub(crate) fn new(
        name: &str,
        params: Vec<Type>,
        ret_ty: Type,
    ) -> Self {
        Self {
            name: name.to_owned(),
            params,
            ret_ty,
        }
    }
}

type BuiltinHandler = fn(&Vec<Value>, &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError>;

pub(crate) struct BuiltinRuntime {
    table: BTreeMap<String, BuiltinHandler>,
}

impl BuiltinRuntime {
    pub(crate) fn new() -> Self {
        Self {
            table: BTreeMap::new(),
        }
    }

    pub(crate) fn add(&mut self, internal_name: &str, handler: BuiltinHandler) {
        self.table.insert(internal_name.to_owned(), handler);
    }

    pub(crate) fn call(&self, identifier: &str, args: &Vec<Value>, node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        match self.table.get(identifier) {
            Some(f) => {
                f(args, node_map)
            }
            None => panic!("unknown builtin function"),
        }
    }
}

pub(crate) fn make_infos() -> Vec<BuiltinInfo> {
    let mut infos = Vec::new();

    infos.push(BuiltinInfo::new(
        "printStr",
        vec![Type::String],
        Type::Void,
    ));

    infos.push(BuiltinInfo::new(
        "printNum",
        vec![Type::Number],
        Type::Void,
    ));

    infos.push(BuiltinInfo::new(
        "printLF",
        vec![],
        Type::Void,
    ));

    infos.push(BuiltinInfo::new(
        "assertEq",
        vec![Type::Number, Type::Number],
        Type::Void,
    ));

    infos.push(BuiltinInfo::new(
        "getUnixtime",
        vec![],
        Type::Number,
    ));

    infos.push(BuiltinInfo::new(
        "concatStr",
        vec![Type::String, Type::String],
        Type::String,
    ));

    infos.push(BuiltinInfo::new(
        "toString",
        vec![Type::Number],
        Type::String,
    ));

    infos
}

pub(crate) fn make_runtime() -> BuiltinRuntime {
    let mut runtime = BuiltinRuntime::new();

    fn print_str(args: &Vec<Value>, node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        let value = args[0].as_string(node_map); // value: string
        print!("{}", value);
        Ok(Value::NoneValue)
    }
    runtime.add("printStr", print_str);

    fn print_num(args: &Vec<Value>, node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        let value = args[0].as_number(node_map); // value: number
        print!("{}", value);
        Ok(Value::NoneValue)
    }
    runtime.add("printNum", print_num);

    fn print_lf(_args: &Vec<Value>, _node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        print!("\n");
        Ok(Value::NoneValue)
    }
    runtime.add("printLF", print_lf);

    fn assert_eq(args: &Vec<Value>, node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        let actual = args[0].as_number(node_map); // actual: number
        let expected = args[1].as_number(node_map); // expected: number
        if actual != expected {
            return Err(RuntimeError::new(format!("assertion error. expected `{}`, actual `{}`.", expected, actual).as_str()));
        }
        Ok(Value::NoneValue)
    }
    runtime.add("assertEq", assert_eq);

    fn get_unixtime(_args: &Vec<Value>, _node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        let unixtime = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH).map_err(|_e| RuntimeError::new("getUnixtime failed"))?
            .as_secs();
        // cast validation
        if unixtime > i64::max_value() as u64 {
            return Err(RuntimeError::new("value is out of range"));
        }
        let unixtime = unixtime as i64;
        Ok(Value::Number(unixtime))
    }
    runtime.add("getUnixtime", get_unixtime);

    fn concat_str(args: &Vec<Value>, node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        let x = args[0].as_string(node_map); // x: string
        let y = args[1].as_string(node_map); // y: string
        let mut value = x.to_string();
        value += y;
        Ok(Value::String(value))
    }
    runtime.add("concatStr", concat_str);

    fn to_string(args: &Vec<Value>, node_map: &BTreeMap<hir::NodeId, hir::Node>) -> Result<Value, RuntimeError> {
        let num = args[0].as_number(node_map); // num: number
        Ok(Value::String(num.to_string()))
    }
    runtime.add("toString", to_string);

    runtime
}
