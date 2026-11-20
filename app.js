// 画面と処理
//
// 画面は4つ。URL の # 以降で切り替える。
//   #/            一覧
//   #/?1=…&2=…    食材で絞り込んだ一覧（条件の書き方は query.js。SPEC 第6節第7段階）
//   #/new         登録
//   #/recipe/<id> 1件を読む（ここから「直す」「消す」）
//   #/edit/<id>   直す（登録と同じ画面に、いまの中身を入れて開く。SPEC 第6節第6段階）
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

// 一覧。上に絞り込みの欄を2つ置く（R3。SPEC 第6節第7段階「画面の使い方」）
//   ・同じ欄の中は「どれか」、欄1と欄2は「両方」。決まりは storage.js（テストで確かめている）
//   ・欄を変えるたびに、その場で一覧と件数を出し直す
//   ・条件は住所の # の後ろに書く。住所は「書き換える」（積み重ねない）ので、
//     欄を何回変えても、スワイプ1回で前の画面に戻れる
function showList() {
  const fields = Query.fromHash(location.hash || "#/");
  const results = el("div");

  function changed() {
    // 住所を書き換える。hashchange は起きないので、画面全体は作り直さない（打っている欄はそのまま）
    history.replaceState(null, "", Query.toHash(fields));
    renderResults();
  }

  function renderResults() {
    const filtering = fields.some((names) => names.length > 0);
    const recipes = Storage.filterRecipes(fields);
    const list = el("ul", { class: "list" });
    for (const r of recipes) {
      // 名前が空なら「（名前なし）」と出す（SPEC 第6節第6段階）
      list.append(el("li", {}, el("a", { href: `#/recipe/${r.id}` }, Storage.titleOf(r))));
    }
    if (!filtering) {
      results.replaceChildren(recipes.length ? list : el("p", { class: "empty" }, "まだレシピがありません"));
    } else if (recipes.length) {
      results.replaceChildren(el("p", { class: "count" }, `${recipes.length} 件（よみの順）`), list);
    } else {
      results.replaceChildren(el("p", { class: "count" }, "当てはまるレシピがありません"));
    }
  }

  renderResults();
  main.replaceChildren(
    el("a", { href: "#/new", class: "button" }, "＋ レシピを登録"),
    el("div", { class: "filter" },
      el("p", { class: "filter-note" }, "食材で絞り込む（同じ欄の中は「どれか」、欄1と欄2は「両方」）"),
      filterField(1, fields[0], changed),
      filterField(2, fields[1], changed)),
    results
  );
}

// 絞り込みの欄を1つ作る。食材の入れ方は登録画面と同じ（打つと、打った文字で始まる食材が候補に出る）。
// ただし、ここでは食材を足す・消すことはできない（候補に「足す」「消す」を出さない）。
// 探しているだけで食材の一覧が変わらないようにするため（SPEC 第6節第7段階）
function filterField(number, names, onChange) {
  const id = `filter${number}`;
  const chosenArea = el("div", { class: "chosen" });
  const query = el("input", { type: "text", id, placeholder: "ひらがなで（例：と）" });
  const candidates = el("ul", { class: "candidates" });

  function renderChosen() {
    chosenArea.replaceChildren(...names.map((name) => el("span", { class: "chip" }, name,
      el("button", { class: "small", onclick: () => {
        names.splice(names.indexOf(name), 1);
        renderChosen();
        renderCandidates();
        onChange();
      } }, "外す"))));
  }

  function choose(name) {
    names.push(name);
    query.value = ""; // 次の食材をすぐ打てるように、欄を空にする（候補も消える）
    renderChosen();
    renderCandidates();
    onChange();
  }

  function renderCandidates() {
    const text = query.value.trim();
    const found = Storage.searchIngredients(text);
    const rows = found.map((name) => el("li", {}, names.includes(name)
      ? el("span", { class: "picked" }, `${name}（入れています）`)
      : el("button", { class: "pick", onclick: () => choose(name) }, name)));
    if (text && !found.length) {
      rows.push(el("li", {}, el("span", { class: "picked" }, `「${text}」で始まる食材はありません`)));
    }
    candidates.replaceChildren(...rows);
  }

  query.addEventListener("input", renderCandidates);
  query.addEventListener("keydown", (e) => {
    // 日本語の変換を確定するための Enter では何もしない
    if (e.key !== "Enter" || e.isComposing) return;
    const text = query.value.trim();
    if (Storage.searchIngredients(text).includes(text) && !names.includes(text)) choose(text);
  });

  renderChosen();
  return el("div", { class: "filter-field" },
    el("label", { for: id }, `欄${number}`), chosenArea, query, candidates);
}

// 登録（recipe なし）と直す（recipe あり）は同じ画面を使う。
// 直すときは、保存を押すまで保存されたレシピは元のまま（SPEC 第6節第6段階）
function showEditor(recipe = null) {
  const title = el("input", { type: "text", id: "title", placeholder: "レシピの名前（あとで入れてもよい）" });
  // 料理名のよみ（SPEC 第6節第7段階）。絞り込んだ一覧をあいうえお順に並べるときにだけ使う
  const yomi = el("input", { type: "text", id: "yomi", placeholder: "ひらがなで（漢字の名前のときだけ。例：ひややっこ）" });
  const body = el("textarea", { id: "body", rows: "12", placeholder: "材料と手順を貼り付け" });
  if (recipe) {
    title.value = recipe.title;
    yomi.value = recipe.yomi;
    body.value = recipe.body;
  }

  // ---- 食材（R2・R8・R9。SPEC 第6節第5段階「画面の使い方」）----
  // 上から順に：選んだ食材（「外す」付き）→ 打つ欄 → 候補（「消す」付き）。
  // 候補は、打った文字で始まる食材だけを出す。何も打っていなければ出さない。
  // 別の画面には移らないので、書きかけの名前や本文はそのまま残る。

  const selected = new Set(recipe ? recipe.ingredients : []); // このレシピに付ける食材（まだ保存していない）
  const chosenArea = el("div", { class: "chosen" });
  const query = el("input", { type: "text", id: "ingredient", placeholder: "食材をひらがなで（例：な）" });
  const candidates = el("ul", { class: "candidates" });
  const message = el("p", { class: "message" });

  function say(text) {
    message.textContent = text;
  }

  // 選んだ食材を、欄の上に横並びで出す。「外す」はこのレシピから外すだけ（一覧には残る）
  function renderChosen() {
    const names = [...selected].sort(new Intl.Collator("ja").compare);
    chosenArea.replaceChildren(...(names.length
      ? names.map((name) => el("span", { class: "chip" }, name,
          el("button", { class: "small", onclick: () => {
            selected.delete(name);
            say(`「${name}」を外しました`);
            render();
          } }, "外す")))
      : [el("span", { class: "empty" }, "まだ選んでいません")]));
  }

  function choose(name) {
    selected.add(name);
    query.value = ""; // 次の食材をすぐ打てるように、欄を空にする（候補も消える）
    render();
  }

  // 候補を出す。打った名前がまだ一覧になければ、最後に「足す」を出す（R8）
  function renderCandidates() {
    const text = query.value.trim();
    const names = Storage.searchIngredients(text);
    const rows = names.map((name) => {
      const pick = selected.has(name)
        ? el("span", { class: "picked" }, `${name}（選んでいます）`)
        : el("button", { class: "pick", onclick: () => { choose(name); say(`「${name}」を選びました`); } }, name);

      // 消す（R9）：使っていない食材は確認なしで消える。
      // いま選んでいる食材と、レシピで使っている食材は消さない。
      // 消せるかどうかの決まりは storage.js にある（テストで確かめられるように）
      const remove = el("button", { class: "small", onclick: () => {
        const result = Storage.removeIngredient(name, [...selected]);
        if (!result.ok) {
          say(result.reason);
          return;
        }
        say(`「${name}」を一覧から消しました`);
        render();
      } }, "消す");

      return el("li", {}, pick, remove);
    });
    if (text && !names.includes(text)) {
      rows.push(el("li", {}, el("button", { class: "pick add", onclick: addIngredient }, `＋「${text}」を一覧に足して選ぶ`)));
    }
    candidates.replaceChildren(...rows);
  }

  function render() {
    renderChosen();
    renderCandidates();
  }

  // 足す（R8）：足せたら、そのまま選ぶ（続けて選ぶ）
  function addIngredient() {
    const result = Storage.addIngredient(query.value);
    if (!result.ok) {
      say(result.reason);
      return;
    }
    choose(result.name);
    say(`「${result.name}」を一覧に足して、選びました`);
  }

  // 1文字打つたびに候補を出し直す（日本語の変換中も含む）
  query.addEventListener("input", () => {
    say("");
    renderCandidates();
  });
  query.addEventListener("keydown", (e) => {
    // 日本語の変換を確定するための Enter では何もしない
    if (e.key !== "Enter" || e.isComposing) return;
    const text = query.value.trim();
    if (Storage.searchIngredients(text).includes(text)) {
      if (!selected.has(text)) { choose(text); say(`「${text}」を選びました`); }
    } else {
      addIngredient();
    }
  });

  render();

  // 名前が空でも保存する。全部空なら保存せず、理由の文を出す（決まりは storage.js）
  const saveMessage = el("p", { class: "message" });
  const save = el("button", {
    onclick: () => {
      const input = { title: title.value, yomi: yomi.value, body: body.value, ingredients: [...selected] };
      const result = recipe ? Storage.updateRecipe(recipe.id, input) : Storage.addRecipe(input);
      if (!result.ok) {
        saveMessage.textContent = result.reason;
        return;
      }
      location.hash = `#/recipe/${recipe ? recipe.id : result.id}`;
    },
  }, recipe ? "保存する" : "登録する");
  main.replaceChildren(
    // 直すときの「もどる」は保存せずに読む画面へ戻る
    recipe ? el("a", { href: `#/recipe/${recipe.id}` }, "← もどる（保存しない）") : el("a", { href: "#/" }, "← 一覧へ"),
    el("label", { for: "title" }, "名前"), title,
    el("label", { for: "yomi" }, "よみ"), yomi,
    el("label", { for: "ingredient" }, "食材"), chosenArea,
    query, candidates,
    message,
    el("label", { for: "body" }, "材料と手順"), body,
    save,
    saveMessage
  );
}

function showRecipe(id) {
  const r = Storage.getRecipe(id);
  if (!r) {
    main.replaceChildren(el("p", {}, "レシピが見つかりません"), el("a", { href: "#/" }, "← 一覧へ"));
    return;
  }
  // 消す（R11）：確認を1回はさむ。iPhone に最初から備わった確認の枠（confirm）を使う。
  // 消したら戻せない。押し間違えないよう、「直す」は上、「消す」は一番下に離して置く
  const remove = el("button", { class: "danger", onclick: () => {
    if (!confirm(`「${Storage.titleOf(r)}」を消しますか？\n消したレシピは戻せません。`)) return;
    Storage.deleteRecipe(r.id);
    location.hash = "#/";
  } }, "このレシピを消す");
  main.replaceChildren(
    el("div", { class: "toolbar" },
      el("a", { href: "#/" }, "← 一覧へ"),
      el("a", { href: `#/edit/${r.id}`, class: "button small-button" }, "直す")),
    el("h2", {}, Storage.titleOf(r)),
    // 付けた食材（古いレシピは「食材なし」として扱う）。
    // 押すと、その食材だけで絞り込んだ一覧へ行く（欄1にその食材、欄2は空。SPEC 第6節第7段階）。
    // ふつうのリンクなので住所が積み重なり、スワイプで戻るとこのレシピに戻る
    r.ingredients.length
      ? el("p", { class: "tags" }, ...r.ingredients.map((name) =>
          el("a", { href: Query.toHash([[name], []]), class: "tag" }, name)))
      : el("p", { class: "empty" }, "食材なし"),
    el("div", { class: "body" }, r.body),
    el("hr", { class: "separator" }),
    remove
  );
}

function route() {
  const hash = location.hash || "#/";
  if (hash === "#/new") showEditor();
  else if (hash.startsWith("#/edit/")) {
    const r = Storage.getRecipe(hash.slice("#/edit/".length));
    if (r) showEditor(r);
    else main.replaceChildren(el("p", {}, "レシピが見つかりません"), el("a", { href: "#/" }, "← 一覧へ"));
  }
  else if (hash.startsWith("#/recipe/")) showRecipe(hash.slice("#/recipe/".length));
  else showList();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
