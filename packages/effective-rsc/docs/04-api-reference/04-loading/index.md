## Loading

> Use Loading to show a fallback while pages or components below a layout are loading.

`ERSC.Loading.make({ render })` creates a Suspense fallback for a Routes scope. `render` returns
React output synchronously and cannot require services. Each scope accepts at most one Loading value,
rendered below its Layout.
