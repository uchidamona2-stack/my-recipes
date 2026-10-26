// 画面と処理
//
// 画面は3つ。URL の # 以降で切り替える。
//   #/            一覧
//   #/new         登録
//   #/recipe/<id> 1件を読む
// データには Storage（storage.js）を通してしか触らない。

const main = document.getElementById("main");

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "onclick") node.addEventListener("click", v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    // 文字は textContent として入れる（貼り付けた文字が HTML として解釈されないように）
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function showList() {
  const recipes = Storage.listRecipes();
  const list = el("ul", { class: "list" });
  for (const r of recipes) {
    list.append(el("li", {}, el("a", { href: `#/recipe/${r.id}` }, r.title)));
  }
  main.replaceChildren(
    el("a", { href: "#/new", class: "button" }, "＋ レシピを登録"),
    recipes.length ? list : el("p", { class: "empty" }, "まだレシピがありません")
  );
}

function showNew() {
  const title = el("input", { type: "text", id: "title", placeholder: "レシピの名前" });
  const body = el("textarea", { id: "body", rows: "12", placeholder: "材料と手順を貼り付け" });
  const save = el("button", {
    onclick: () => {
      if (!title.value.trim()) {
        title.focus();
        return;
      }
      const id = Storage.addRecipe({ title: title.value.trim(), body: body.value });
      location.hash = `#/recipe/${id}`;
    },
  }, "登録する");
  main.replaceChildren(
    el("a", { href: "#/" }, "← 一覧へ"),
    el("label", { for: "title" }, "名前"), title,
    el("label", { for: "body" }, "材料と手順"), body,
    save
  );
}

function showRecipe(id) {
  const r = Storage.getRecipe(id);
  if (!r) {
    main.replaceChildren(el("p", {}, "レシピが見つかりません"), el("a", { href: "#/" }, "← 一覧へ"));
    return;
  }
  main.replaceChildren(
    el("a", { href: "#/" }, "← 一覧へ"),
    el("h2", {}, r.title),
    el("div", { class: "body" }, r.body)
  );
}

function route() {
  const hash = location.hash || "#/";
  if (hash === "#/new") showNew();
  else if (hash.startsWith("#/recipe/")) showRecipe(hash.slice("#/recipe/".length));
  else showList();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
