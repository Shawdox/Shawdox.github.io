---
date: 2024/01/13 
title: (技术积累)(Part 1)How does Wasm module interact with JavaScripte in browser?
author: Shaw
categories: Paper
tags: ["WASM"]
---

# (Part 1)How does Wasm module interact with JavaScripte in browser?

>Reference:
>
>- ***WebAssembly in Action***. Chapter 4.1

## Background

假设一个公司有一个用C++开发的销售程序，但想开发一个网页端销售接口用于对用户输入的数据进行验证，例如：



<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240113154003567.png" style="zoom: 50%;" />

整个业务系统的逻辑如下：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240113154343378.png" style="zoom: 67%;" />

用户填写的数据要在浏览器端和服务器端都进行验证，理由如下：

1. 使用户端响应更快；
2. 减少服务端负载；

尽管在浏览器中验证用户数据很有帮助，但不能假定数据在到达服务器时就是完美的；有一些方法可以绕过浏览器的验证检查。无论数据是无意提交的还是用户有意提交的，您都不希望冒险向数据库中添加不良数据。无论浏览器中的验证有多好，服务器端代码都必须始终验证它接收到的数据。

在浏览器端，我们需要构建的验证功能有：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240113154946589.png" style="zoom:67%;" />

实现该功能的C++代码如下：

1. 检测一个值是否为空：

```c++
int ValidateValueProvided(const char* value, const char* error_message, char* return_error_message){
    // If the string is null or the first character is the null terminator then the string is empty
    if ((value == NULL) || (value[0] == '\0')){
        strcpy(return_error_message, error_message);
        return 0;
    }
    // Everything is ok
    return 1;
}
```

2. 检测`Name`属性是否合理（非空，长度限制）：

```c++
int ValidateName(char* name, int maximum_length, char* return_error_message){
    // Validation 1: A name must be provided
    if (ValidateValueProvided(name, "A Product Name must be provided.", return_error_message) == 0){ return 0; }
    // Validation 2: A name must not exceed the specified length
    if (strlen(name) > maximum_length){
        strcpy(return_error_message, "The Product Name is too long.");
        return 0;
    }
    // Everything is ok (no issues with the name)
    return 1;
}

```

3. 检查目录ID是否存在：

```c++
int IsCategoryIdInArray(char* selected_category_id, int* valid_category_ids, int array_length){
    // Loop through the array of valid ids that were passed in...
    int category_id = atoi(selected_category_id);
    for (int index = 0; index < array_length; index++){
      // If the selected id is in the array then...
      if (valid_category_ids[index] == category_id){
        // The user has a valid selection so exit now
        return 1;
      }
    }
    // We did not find the category id in the array
    return 0;
  }
```

4. 检查`Category`属性是否合理：

```c++
int ValidateCategory(char* category_id, int* valid_category_ids, int array_length, char* return_error_message){
    // Validation 1: A Category ID must be selected
    if (ValidateValueProvided(category_id, "A Product Category must be selected.", return_error_message) == 0){
      return 0;
    }
    // Validation 2: A list of valid Category IDs must be passed in
    if ((valid_category_ids == NULL) || (array_length == 0)){
      strcpy(return_error_message, "There are no Product Categories available.");
      return 0;
    }
    // Validation 3: The selected Category ID must match one of the IDs provided
    if (IsCategoryIdInArray(category_id, valid_category_ids, array_length) == 0){
      strcpy(return_error_message, "The selected Product Category is not valid.");
      return 0;
    }
    // Everything is ok (no issues with the category id)
    return 1;
  }
```

## Emscripten

我们要使用上述代码中的`ValidateName`和`ValidateCategory`两个函数来验证用户在网页端的输入是否合理，这就必然涉及到Wasm与JS交互的问题，为了防止C++重命名函数导致JS无法调用，这里需要在被编译的函数外包上如下宏：

```c++
#ifdef __cplusplus
extern "C" { // So that the C++ compiler does not rename our function names
#endif
    //...
#ifdef __cplusplus
}
#endif
```

另外，需要在这两个函数的前面加上如下的宏来使其自动变为export function：

```C++
#ifdef __EMSCRIPTEN__ 
EMSCRIPTEN_KEEPALIVE 
#endif
```

当然，在编译时也可以通过命令行`EXPORTED_FUNCIONTS`参数来指定export function。

在文件的开头，加上Emscripten相关头文件：

```C++
#ifdef __EMSCRIPTEN__
  #include <emscripten.h>
#endif
```

## Compilation

```bash
emcc validate.cpp -o validate.js -s EXPORTED_RUNTIME_METHODS=['ccall','UTF8ToString']
```

`EXPORTED_RUNTIME_METHODS`指定了Emscripten helper functions：`ccall`,`UTF8ToString`。

## Web page

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Edit Product</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.1.0/css/bootstrap.min.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.0/umd/popper.min.js"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.1.0/js/bootstrap.min.js"></script>
  </head>
  <body onload="initializePage()">
    <div class="container">
      <h1>Edit Product</h1>

      <div id="errorMessage" class="alert alert-danger" role="alert" style="display:none;">
      </div>

      <div class="form-group">
        <label for="name">Name:</label>
        <input type="text" class="form-control" id="name">
      </div>
      <div class="form-group">
        <label for="category">Category:</label>
        <select class="custom-select" id="category">
          <option value="0"></option>
          <option value="100">Jeans</option>
          <option value="101">Dress Pants</option>
        </select>
      </div>
 
      <button type="button" class="btn btn-primary" onclick="onClickSave()">Save</button>
    </div>

    <script src="editproduct.js"></script>
    <script src="validate.js"></script>
  </body>
</html>
```

## Creating the JavaScript that will interact with the module

这里构建一个editproduct.js，用于Wasm和html之间的交互.

1. 初始化数据显示：

```javascript
const initialData = { 
    name: "Women's Mid Rise Skinny Jeans", 
    categoryId: "100", 
}
```

2. 定义常量`MAXIMUM_NAME_LENGTH`和`VALID_CATEGORY_IDS	`用来表示`name`的最大长度和有效目录ID数组：

```javascript
const MAXIMUM_NAME_LENGTH = 50; 
const VALID_CATEGORY_IDS = [100, 101];
```

3. 补充HTML中的`initializePage`函数，使其用`initialData`填充表单：

```javascript
function initializePage() {
  // 初始化name
  document.getElementById("name").value = initialData.name;
  const category = document.getElementById("category");
  const count = category.length;
  for (let index = 0; index < count; index++) {
    // 如果value合理，则初始化Index，让Select选中这个键
    if (category[index].value === initialData.categoryId) {
      category.selectedIndex = index;
      break;
    }
  }
}
```

4. 定义函数`getSelectedCategoryId`来获取category中被选中的项：

```javascript
function getSelectedCategoryId() {
  const category = document.getElementById("category");
  const index = category.selectedIndex;
  if (index !== -1) { return category[index].value; }
  return "0";
}
```

5. 在HTML文件中，设置了一个名为`errorMessage`的初始不可见的div块，这里要定义函数`setErrorMessage`来将错误信息显示到这个div上：

```javascript
function setErrorMessage(error) {
  const errorMessage = document.getElementById("errorMessage");
  errorMessage.innerText = error; 
  errorMessage.style.display = (error === "" ? "none" : "");
}
```

6. 补充`onClickSave`函数，使其在被点击时调用`ValidateName`和`ValidateCategory`两个函数来验证用户在网页端的输入是否合理，并根据结果向服务器发送信息/报错：

这里，JS需要传递给`ValidateName`一个buffer name和一个错误信息指针，其会读取name中的内容并将可能的错误信息写如错误指针处的内存。

注意到C++中的`ValidateName`和`ValidateCategory`都会使用char指针来传递错误信息，但由于Wasm只支持四种基本类型的数据，故想要把这个信息传给JS代码就需要使用memory。

Emscripten plumbing code提供了符合C标准的`_malloc`和 `_free`函数来操纵Wasm的内存：

```javascript
function onClickSave() {
  let errorMessage = "";
  const errorMessagePointer = Module._malloc(256);
  //从HTML中获取用户输入的值
  const name = document.getElementById("name").value;
  const categoryId = getSelectedCategoryId();

  if (!validateName(name, errorMessagePointer) ||
      !validateCategory(categoryId, errorMessagePointer)) {
    errorMessage = Module.UTF8ToString(errorMessagePointer);
  } 
  Module._free(errorMessagePointer);
  setErrorMessage(errorMessage);
  if (errorMessage === "") {
    // everything is ok...we can pass the data to the server-side code
  }
}
```

其中，`UTF8ToString`函数用于从Wasm内存中读取字符串。

注意此时的`ValidateName`和`ValidateCategory`都还是JS函数，我们这里使用与Wasm同名的包装函数，通过Emscripten helper function ccall来调用Wasm中的函数：

```JavaScript
function validateName(name, errorMessagePointer) {
  const isValid = Module.ccall('ValidateName',
      'number',
      ['string', 'number', 'number'],
      [name, MAXIMUM_NAME_LENGTH, errorMessagePointer]);

  return (isValid === 1);
}
```
通过开头定义的全局变量来给`validateCategory`传递数组长度等信息：
```javascript
function validateCategory(categoryId, errorMessagePointer) {
  const arrayLength = VALID_CATEGORY_IDS.length;
  const bytesPerElement = Module.HEAP32.BYTES_PER_ELEMENT;
  const arrayPointer = Module._malloc((arrayLength * bytesPerElement));
  // 为VALID_CATEGORY_IDS分配一块内存并将其设置为数组的内容
  Module.HEAP32.set(VALID_CATEGORY_IDS, (arrayPointer / bytesPerElement));

  const isValid = Module.ccall('ValidateCategory', 
      'number',
      ['string', 'number', 'number', 'number'],
      [categoryId, arrayPointer, arrayLength, errorMessagePointer]);

  Module._free(arrayPointer);

  return (isValid === 1);
}
```

以上就是editproduct.js的全部内容，validate.js会将Wasm模块初始化，而editproduct.js会初始化界面、在用户点击按钮后调用Wasm函数，返回判断结果，充当Wasm模块与浏览器之间的桥梁。
