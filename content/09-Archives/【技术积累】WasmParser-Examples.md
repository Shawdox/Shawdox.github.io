---
date: 2024/04/24
title: (技术积累)WasmParser Examples
author: Shaw
categories: Paper
tags: ["Rust","WebAssembly"]
---

# WasmParser Examples解析

>针对Rust库Wasmparesr中给出的如下样例：
>
>https://docs.rs/wasmparser/latest/wasmparser/struct.Parser.html#method.parse
>
>https://docs.rs/wasmparser/latest/wasmparser/struct.Parser.html#method.parse_all
>
>的解析



## 1. 相关数据结构

#### 1.1 Payload

>Payload表示可以从Wasm module/component中分析的所有chuck的枚举类型。
>
>对于许多section来说，整个section都是被一次性解析的，除了CodeSection（可以被流式解析）。
>
>Payload返回的每个Section并不一定都被parse了，可能会返回对应的Reader，需要通过该Reader进一步分解。

```rust
pub enum Payload<'a> {
    Version {
        num: u16,
        encoding: Encoding,
        range: Range<usize>,
    },
    TypeSection(TypeSectionReader<'a>),
    ImportSection(ImportSectionReader<'a>),
    FunctionSection(FunctionSectionReader<'a>),
    TableSection(TableSectionReader<'a>),
    MemorySection(MemorySectionReader<'a>),
    TagSection(TagSectionReader<'a>),
    GlobalSection(GlobalSectionReader<'a>),
    ExportSection(ExportSectionReader<'a>),
    StartSection {
        func: u32,
        range: Range<usize>,
    },
    ElementSection(ElementSectionReader<'a>),
    DataCountSection {
        count: u32,
        range: Range<usize>,
    },
    DataSection(DataSectionReader<'a>),
    CodeSectionStart {
        count: u32,
        range: Range<usize>,
        size: u32,
    },
    CodeSectionEntry(FunctionBody<'a>),
    ModuleSection {
        parser: Parser,
        unchecked_range: Range<usize>,
    },
    InstanceSection(InstanceSectionReader<'a>),
    CoreTypeSection(CoreTypeSectionReader<'a>),
    ComponentSection {
        parser: Parser,
        unchecked_range: Range<usize>,
    },
    ComponentInstanceSection(ComponentInstanceSectionReader<'a>),
    ComponentAliasSection(SectionLimited<'a, ComponentAlias<'a>>),
    ComponentTypeSection(ComponentTypeSectionReader<'a>),
    ComponentCanonicalSection(ComponentCanonicalSectionReader<'a>),
    ComponentStartSection {
        start: ComponentStartFunction,
        range: Range<usize>,
    },
    ComponentImportSection(ComponentImportSectionReader<'a>),
    ComponentExportSection(ComponentExportSectionReader<'a>),
    CustomSection(CustomSectionReader<'a>),
    UnknownSection {
        id: u8,
        contents: &'a [u8],
        range: Range<usize>,
    },
    End(usize),
}
```

#### 1.2 Chunk

>表明是否需要更多数据 or 已经分析完毕。
>
>Parsed包含了已经分析的数据大小consumed和分析payload。

```rust
pub enum Chunk<'a> {
    NeedMoreData(u64),
    Parsed {
        consumed: usize,
        payload: Payload<'a>,
    },
}
```

## 3. wasmparser::parse

>Source: https://docs.rs/wasmparser/latest/src/wasmparser/parser.rs.html#527-563

```rust
pub fn parse<'a>(&mut self, data: &'a [u8], eof: bool) -> Result<Chunk<'a>>
```

`parse`函数为结构体Parser的method：

```rust
#[derive(Debug, Clone)]
pub struct Parser {
    state: State,
    offset: u64,
    max_size: u64,
    encoding: Encoding,
}
```

`parse`函数用于分析已经接收到的Wasm模块数据，其接受两个参数`data`和`eof`。`data`表示已经获取到的Wasm数据，`eof`表示是否会有更多数据到达。

`parse`函数返回两种结果：

- `Chunk::NeedMoreData`：表明当前到达的数据还不足以分析；
- `Chunk::Parsed`：到达的数据已经分析完成。

## 4. Example1: parser

>从std::io::Read中流式读取Wasm文件并逐步分析该文件

```rust
use std::io::Read;
use anyhow::Result;
use wasmparser::{Parser, Chunk, Payload::*};

fn parse(mut reader: impl Read) -> Result<()> {
    let mut buf = Vec::new();
    let mut cur = Parser::new(0); //定义一个offset为0的Parser实例，max_size = u64::MAX
    let mut eof = false;
    let mut stack = Vec::new();

    loop {
        let (payload, consumed) = match cur.parse(&buf, eof)? {
            Chunk::NeedMoreData(hint) => { //表明当前到达的数据还不足以分析
                assert!(!eof); // 如果数据不足+到达文件末尾，则表明出错

                // Use the hint to preallocate more space, then read
                // some more data into our buffer.
                //
                // Note that the buffer management here is not ideal,
                // but it's compact enough to fit in an example!
                let len = buf.len();
                buf.extend((0..hint).map(|_| 0u8));
                let n = reader.read(&mut buf[len..])?; //读取更多数据
                buf.truncate(len + n); //截断
                eof = n == 0; //重新判断是否到达文件末尾
                continue;
            }

            Chunk::Parsed { consumed, payload } => (payload, consumed), // 返回已分析数据大小和payload
        };

        match payload { // 分析payload
            // Sections for WebAssembly modules
            Version { .. } => { /* ... */ }
            TypeSection(_) => { /* ... */ }
            ImportSection(_) => { /* ... */ }
            FunctionSection(_) => { /* ... */ }
            TableSection(_) => { /* ... */ }
            MemorySection(_) => { /* ... */ }
            TagSection(_) => { /* ... */ }
            GlobalSection(_) => { /* ... */ }
            ExportSection(_) => { /* ... */ }
            StartSection { .. } => { /* ... */ }
            ElementSection(_) => { /* ... */ }
            DataCountSection { .. } => { /* ... */ }
            DataSection(_) => { /* ... */ }

            // Here we know how many functions we'll be receiving as
            // `CodeSectionEntry`, so we can prepare for that, and
            // afterwards we can parse and handle each function
            // individually.
            CodeSectionStart { .. } => { /* ... */ }
            CodeSectionEntry(body) => {
                // here we can iterate over `body` to parse the function
                // and its locals
            }

            // Sections for WebAssembly components
            InstanceSection(_) => { /* ... */ }
            CoreTypeSection(_) => { /* ... */ }
            ComponentInstanceSection(_) => { /* ... */ }
            ComponentAliasSection(_) => { /* ... */ }
            ComponentTypeSection(_) => { /* ... */ }
            ComponentCanonicalSection(_) => { /* ... */ }
            ComponentStartSection { .. } => { /* ... */ }
            ComponentImportSection(_) => { /* ... */ }
            ComponentExportSection(_) => { /* ... */ }

            ModuleSection { parser, .. }
            | ComponentSection { parser, .. } => {
                stack.push(cur.clone());
                cur = parser.clone();
            }

            CustomSection(_) => { /* ... */ }

            // most likely you'd return an error here
            UnknownSection { id, .. } => { /* ... */ }

            // Once we've reached the end of a parser we either resume
            // at the parent parser or we break out of the loop because
            // we're done.
            End(_) => {
                if let Some(parent_parser) = stack.pop() { // 这里实现了一个类似stack的结构来存储多个parser
                    cur = parent_parser;
                } else {
                    break;
                }
            }
        }

        // once we're done processing the payload we can forget the
        // original.
        buf.drain(..consumed);
    }

    Ok(())
}
```

## 5. Example 2: parser_all

>用于分析已经完整读进内存的Wasm module/component

```rust
use std::io::Read;
use anyhow::Result;
use wasmparser::{Parser, Chunk, Payload::*};

fn parse(mut reader: impl Read) -> Result<()> {
    let mut buf = Vec::new();
    reader.read_to_end(&mut buf)?; // 读取数据
    let parser = Parser::new(0); //初始化parser

    for payload in parser.parse_all(&buf) {
        match payload? {
            // Sections for WebAssembly modules
            Version { .. } => { /* ... */ }
            TypeSection(_) => { /* ... */ }
            ImportSection(_) => { /* ... */ }
            FunctionSection(_) => { /* ... */ }
            TableSection(_) => { /* ... */ }
            MemorySection(_) => { /* ... */ }
            TagSection(_) => { /* ... */ }
            GlobalSection(_) => { /* ... */ }
            ExportSection(_) => { /* ... */ }
            StartSection { .. } => { /* ... */ }
            ElementSection(_) => { /* ... */ }
            DataCountSection { .. } => { /* ... */ }
            DataSection(_) => { /* ... */ }

            // Here we know how many functions we'll be receiving as
            // `CodeSectionEntry`, so we can prepare for that, and
            // afterwards we can parse and handle each function
            // individually.
            CodeSectionStart { .. } => { /* ... */ }
            CodeSectionEntry(body) => {
                // here we can iterate over `body` to parse the function
                // and its locals
            }

            // Sections for WebAssembly components
            ModuleSection { .. } => { /* ... */ }
            InstanceSection(_) => { /* ... */ }
            CoreTypeSection(_) => { /* ... */ }
            ComponentSection { .. } => { /* ... */ }
            ComponentInstanceSection(_) => { /* ... */ }
            ComponentAliasSection(_) => { /* ... */ }
            ComponentTypeSection(_) => { /* ... */ }
            ComponentCanonicalSection(_) => { /* ... */ }
            ComponentStartSection { .. } => { /* ... */ }
            ComponentImportSection(_) => { /* ... */ }
            ComponentExportSection(_) => { /* ... */ }

            CustomSection(_) => { /* ... */ }

            // most likely you'd return an error here
            UnknownSection { id, .. } => { /* ... */ }

            // Once we've reached the end of a parser we either resume
            // at the parent parser or the payload iterator is at its
            // end and we're done.
            End(_) => {}
        }
    }

    Ok(())
}
```

