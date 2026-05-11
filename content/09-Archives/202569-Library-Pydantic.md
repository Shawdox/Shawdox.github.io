---
date: 2025/6/9
title: Library Pydantic
author: Shaw
categories: Paper
tags: ["Python"]

---

# Pydantic

Pydantic is the most widely used data validation library for Python. Pydantic's core validation logic is implemented in a separate package [`pydantic-core`](https://github.com/pydantic/pydantic-core), where validation for most types is implemented in Rust. So Pydantic is among the fastest data validation libraries for Python.



A simple example of Pydantic:

```python
from datetime import datetime

from pydantic import BaseModel, PositiveInt


class User(BaseModel):
    # id is an integer, and parameter can not be transferred to int will raise an error.
    id: int 
    name: str = 'John Doe'  
    signup_ts: datetime | None  
    tastes: dict[str, PositiveInt]  


external_data = {
    'id': 123,
    'signup_ts': '2019-06-01 12:22',  
    'tastes': {
        'wine': 9,
        b'cheese': 7,  
        'cabbage': '1',  
    },
}

user = User(**external_data)  
```

In Python, the `**` operator is used to unpack a <u>dictionary</u> into keyword arguments. In the given code, `User(**external_data)` unpacks the `external_data` dictionary and passes its key-value pairs as keyword arguments to the `User` class constructor, which is equivalent to:

```python
User(
    id=123,
    signup_ts='2019-06-01 12:22',
    tastes={'wine': 9, 'cheese': 7, 'cabbage': '1'}
)
```

With out `**`, paras need to be passed through:

```python
user = User(
    id=external_data['id'],
    signup_ts=external_data['signup_ts'],
    tastes=external_data['tastes']
)
```

The class `user` can be used normally:

```python

print(user.id)  
#> 123
print(user.model_dump())  
"""
{
    'id': 123,
    'name': 'John Doe',
    'signup_ts': datetime.datetime(2019, 6, 1, 12, 22),
    'tastes': {'wine': 9, 'cheese': 7, 'cabbage': 1},
}
"""
```

### BasicModel

```python
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str = 'Jane Doe'
```

Without pydantic:

```python
class User():
    def __init__(self, id: int, name: str):
        self.id = id
        self.name = name
```



