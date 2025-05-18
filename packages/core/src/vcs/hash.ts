/*
This is the Rust code from vcs/hash.rs that needs to be ported to Typescript in this vcs/hash.ts file:
```rs
use std::fmt::{Debug, Display};

use serde::{Deserialize, Serialize};

pub trait Hash:
    Copy
    + Default
    + Display
    + Debug
    + Eq
    + Send
    + Sync
    + 'static
    + Serialize
    + for<'de> Deserialize<'de>
{
}
```
*/