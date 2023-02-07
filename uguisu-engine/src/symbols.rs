use std::collections::HashMap;
use crate::graph;

pub(crate) struct ResolverStack {
    frames: Vec<ResolverFrame>,
    trace: bool,
}

impl ResolverStack {
    pub(crate) fn new(trace: bool) -> Self {
        Self {
            frames: vec![ResolverFrame::new()],
            trace,
        }
    }

    pub(crate) fn is_root_frame(&mut self) -> bool {
        self.frames.len() == 1
    }

    pub(crate) fn push_frame(&mut self) {
        if self.trace { println!("push_frame"); }
        self.frames.insert(0, ResolverFrame::new());
    }

    pub(crate) fn pop_frame(&mut self) {
        if self.trace { println!("pop_frame"); }
        if self.is_root_frame() {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    pub(crate) fn set_identifier(&mut self, identifier: &str, node: graph::NodeRef) {
        if self.trace { println!("set_identifier (identifier: \"{}\", node_id: [{}])", identifier, node.id); }
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(identifier.to_string(), node);
            }
            None => panic!("frame not found"),
        }
    }

    pub(crate) fn lookup_identifier(&self, identifier: &str) -> Option<graph::NodeRef> {
        for frame in self.frames.iter() {
            match frame.table.get(identifier) {
                Some(&node) => {
                    if self.trace { println!("lookup_identifier success (identifier: \"{}\", node_id: {})", identifier, node.id); }
                    return Some(node)
                }
                None => {
                    if self.trace { println!("lookup_identifier failure (identifier: \"{}\")", identifier); }
                }
            }
        }
        None
    }
}

struct ResolverFrame {
    table: HashMap<String, graph::NodeRef>,
}

impl ResolverFrame {
    fn new() -> Self {
        Self {
            table: HashMap::new(),
        }
    }
}

pub(crate) struct SymbolTable {
    table: HashMap<graph::NodeId, SymbolRecord>,
    trace: bool,
}

impl SymbolTable {
    pub(crate) fn new() -> Self {
        Self {
            table: HashMap::new(),
            trace: false,
        }
    }

    pub(crate) fn set_trace(&mut self, enabled: bool) {
        self.trace = enabled;
    }

    pub(crate) fn new_record(&mut self, node: graph::NodeRef) {
        let record = SymbolRecord {
            ty: None,
            pos: None,
        };
        self.table.insert(node.id, record);
    }

    pub(crate) fn set_ty(&mut self, node: graph::NodeRef, ty: Type) {
        if self.trace { println!("set_ty (node_id: [{}], ty: {:?})", node.id, ty); }
        let record = match self.table.get_mut(&node.id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.ty = Some(ty);
    }

    pub(crate) fn set_pos(&mut self, node: graph::NodeRef, pos: (usize, usize)) {
        if self.trace { println!("set_pos (node_id: [{}], pos: {:?})", node.id, pos); }
        let record = match self.table.get_mut(&node.id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.pos = Some(pos);
    }

    pub(crate) fn get(&self, node: graph::NodeRef) -> &SymbolRecord {
        if self.trace { println!("get (node_id: [{}])", node.id); }
        match self.table.get(&node.id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        }
    }
}

#[derive(Debug)]
pub(crate) struct SymbolRecord {
    pub ty: Option<Type>,
    pub pos: Option<(usize, usize)>,
}

#[derive(Debug, PartialEq, Clone, Copy)]
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

    pub(crate) fn from_identifier(ty_identifier: &str) -> Result<Type, String> {
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
