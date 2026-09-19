## Layout

> Use Layout for UI shared by several pages, such as navigation and the HTML document.

`ERSC.Layout.make({ render })` creates a wrapper whose `render({ children })` returns an Effect
producing React output. It can use application and middleware services. The root Layout must include
`<html>` and `<body>`; nested Layouts wrap their child routes.
