use std::collections::BTreeMap;
use std::time::SystemTime;
use crate::RuntimeError;
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

type BuiltinHandler = fn(&Vec<Value>) -> Result<Value, RuntimeError>;

pub(crate) struct BuiltinRuntime {
    table: BTreeMap<String, BuiltinHandler>,
}

impl BuiltinRuntime {
    fn new() -> Self {
        Self {
            table: BTreeMap::new(),
        }
    }

    fn add(&mut self, internal_name: &str, handler: BuiltinHandler) {
        self.table.insert(internal_name.to_owned(), handler);
    }

    pub(crate) fn call(&self, identifier: &str, args: &Vec<Value>) -> Result<Value, RuntimeError> {
        match self.table.get(identifier) {
            Some(f) => {
                f(args)
            }
            None => panic!("unknown builtin function"),
        }
    }
}

pub(crate) fn make_infos() -> Vec<BuiltinInfo> {
    let mut infos = Vec::new();
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

    infos
}

pub(crate) fn make_runtime() -> BuiltinRuntime {
    let mut runtime = BuiltinRuntime::new();

    fn print_num(args: &Vec<Value>) -> Result<Value, RuntimeError> {
        let value = args[0].as_number(); // value: number
        print!("{}", value);
        Ok(Value::NoneValue)
    }
    runtime.add("printNum", print_num);

    fn print_lf(_args: &Vec<Value>) -> Result<Value, RuntimeError> {
        print!("\n");
        Ok(Value::NoneValue)
    }
    runtime.add("printLF", print_lf);

    fn assert_eq(args: &Vec<Value>) -> Result<Value, RuntimeError> {
        let actual = args[0].as_number(); // actual: number
        let expected = args[1].as_number(); // expected: number
        if actual != expected {
            return Err(RuntimeError::new(format!("assertion error. expected `{}`, actual `{}`.", expected, actual).as_str()));
        }
        Ok(Value::NoneValue)
    }
    runtime.add("assertEq", assert_eq);

    fn get_unixtime(_args: &Vec<Value>) -> Result<Value, RuntimeError> {
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

    runtime
}
