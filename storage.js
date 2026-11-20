// 保存の窓口（SPEC 第7節「保存を1か所に閉じ込める」）
//
// レシピと食材の一覧の保存と取り出しは、すべてこのファイルを通す。
// ほかのファイルは localStorage に直接触らない。
// 保存のしかたを変えるときは、このファイルだけを直す。
//
// いまの保存先：localStorage（ブラウザが、このサイト専用に iPhone の中に用意する保存場所）
//
// 保存先は createStorage に外から渡す。アプリは本物の localStorage を、
// テスト（tests.html）は偽物の保存場所を渡す。テストが本物のレシピに触れないようにするため
// （SPEC 第7節「確かめ方：テストを先に書く」）。
//
// 時刻も外から渡せる（省略すると本物の時計）。テストでは1ずつ進む偽物の時計を渡し、
// 「どちらが後に保存されたか」が同じ1000分の1秒に重なって決まらない、ということを防ぐ。
//
// 保存しているもの（SPEC 第6節第5段階「データの持ち方」・第6段階）
//   レシピ     … { id, title, yomi, body, createdAt, updatedAt, ingredients: ["おくら", "なす"] }
//                 title は空でもよい（画面では「（名前なし）」と出す）。
//                 yomi は料理名のよみ（ひらがなと「ー」だけ。空でもよい）。絞り込んだ一覧を
//                 あいうえお順に並べるときにだけ使う（SPEC 第6節第7段階「料理名のよみ」）。
//                 updatedAt は直して保存したときだけ付く（直したことのないレシピにはない）
//   食材の一覧 … ["おくら", "なす", …]（名前だけを持つ。番号は付けない）

function createStorage(backend, now = () => Date.now()) {
  const KEY = "my-recipes:v1";
  const INGREDIENTS_KEY = "my-recipes:ingredients:v1";

  // あいうえお順に並べるための比べ方（日本語の辞書の順）
  const collator = new Intl.Collator("ja");

  // 足せる名前：ひらがなと長音の「ー」だけ（R8）
  const NAME_PATTERN = /^[ぁ-ゖー]+$/;

  function load(key) {
    try {
      const text = backend.getItem(key);
      return text ? JSON.parse(text) : [];
    } catch (e) {
      return [];
    }
  }

  function save(key, value) {
    backend.setItem(key, JSON.stringify(value));
  }

  // 保存されたレシピを、画面に渡す形にそろえる。
  // 最初の1本で登録したレシピには食材の欄がないので、「食材なし」とみなす。
  // よみの欄がない、前から登録してあるレシピは、よみが空とみなす（SPEC 第6節第7段階）。
  // 保存されたデータそのものは書き換えない（SPEC 第6節第5段階）。
  function view(recipe) {
    return { ...recipe, ingredients: recipe.ingredients || [], yomi: recipe.yomi || "" };
  }

  function newId() {
    return now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // 一覧に並べるときの時刻：最後に直した時刻。直したことがなければ登録した時刻
  // （古いレシピは読むときにそうみなすだけで、データには書き足さない。SPEC 第6節第6段階）
  function touchedAt(recipe) {
    return recipe.updatedAt || recipe.createdAt;
  }

  // 保存する前に、打った中身をそろえて確かめる（SPEC 第6節第6段階「名前が空のレシピ」・第7段階「料理名のよみ」）
  //   ・名前とよみは前後の空白を取る。空白だけなら空として保存する
  //   ・よみに、ひらがなと「ー」以外が入っていたら保存しない
  //   ・名前・よみ・材料と手順・食材が全部空なら保存しない（空白や改行だけの欄も空とみなす）
  // 保存してよければ { ok: true, fields }、だめなら { ok: false, reason } を返す
  function prepare({ title = "", yomi = "", body = "", ingredients = [] }) {
    const fields = { title: title.trim(), yomi: yomi.trim(), body, ingredients: [...ingredients] };
    if (fields.yomi && !NAME_PATTERN.test(fields.yomi)) {
      return { ok: false, reason: YOMI_REASON };
    }
    if (!fields.title && !fields.yomi && !body.trim() && fields.ingredients.length === 0) {
      return { ok: false, reason: EMPTY_REASON };
    }
    return { ok: true, fields };
  }

  // 絞り込んだ一覧の並べ方（SPEC 第6節第7段階）：よみのあいうえお順。
  // よみが空なら名前そのもので並べ、名前もよみもないレシピは最後に置く
  function sortKey(recipe) {
    return recipe.yomi || recipe.title;
  }
  function byYomi(a, b) {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (!ka || !kb) return (ka ? 0 : 1) - (kb ? 0 : 1);
    return collator.compare(ka, kb);
  }

  const EMPTY_REASON = "何も入っていないので、保存していません";
  const YOMI_REASON = "よみは、ひらがなと「ー」だけで入れてください";
  const NOT_FOUND_REASON = "レシピが見つかりません";

  return {
    // ---- レシピ ----

    // 登録したレシピをすべて返す。最後に登録したか直したものが先（SPEC 第6節第6段階）
    listRecipes() {
      return load(KEY).map(view).sort((a, b) => touchedAt(b) - touchedAt(a));
    },

    // 食材で絞り込む（R3。SPEC 第6節第7段階「絞り込みの決まり」）。
    // fields は欄1・欄2の中身：[["とうふ", "きぬどうふ"], ["ぶたこま"]]
    //   ・同じ欄の中は「どれか」（OR）、欄どうしは「両方」（AND）
    //   ・空の欄はないものとする。両方空なら絞り込まず、ふだんの一覧（最後に登録したか直した順）を返す
    //   ・「合う」のは名前が同じときだけ（「とうふ」で「きぬどうふ」は合わない）
    //   ・絞り込んだ一覧は、よみのあいうえお順
    // 読むだけで、保存されたデータは書き換えない
    filterRecipes(fields) {
      const used = fields.filter((names) => names.length > 0);
      if (used.length === 0) return this.listRecipes();
      return load(KEY).map(view)
        .filter((r) => used.every((names) => names.some((n) => r.ingredients.includes(n))))
        .sort(byYomi);
    },

    // 画面に出す名前。名前が空なら「（名前なし）」（データには入れない。SPEC 第6節第6段階）
    titleOf(recipe) {
      return recipe.title || "（名前なし）";
    },

    // id で1件を返す。見つからなければ null
    getRecipe(id) {
      const r = load(KEY).find((r) => r.id === id);
      return r ? view(r) : null;
    },

    // 1件を登録する（R1）。登録できたら { ok: true, id }、
    // できなければ { ok: false, reason } を返す（reason は画面に出す文）
    addRecipe(input) {
      const checked = prepare(input);
      if (!checked.ok) return checked;
      const recipes = load(KEY);
      const recipe = { id: newId(), ...checked.fields, createdAt: now() };
      recipes.push(recipe);
      save(KEY, recipes);
      return { ok: true, id: recipe.id };
    },

    // 1件を直して保存する（R10）。id・登録した時刻はそのまま、最後に直した時刻を付ける。
    // 保存できたら { ok: true }、できなければ { ok: false, reason }（保存されたレシピは元のまま）
    updateRecipe(id, input) {
      const recipes = load(KEY);
      const i = recipes.findIndex((r) => r.id === id);
      if (i === -1) return { ok: false, reason: NOT_FOUND_REASON };
      const checked = prepare(input);
      if (!checked.ok) return checked;
      recipes[i] = { ...recipes[i], ...checked.fields, updatedAt: now() };
      save(KEY, recipes);
      return { ok: true };
    },

    // 1件を消す（R11）。消したら戻せない。付けていた食材は一覧に残す（SPEC 第6節第6段階）。
    // 消す前の確認は画面（app.js）の役目
    deleteRecipe(id) {
      const recipes = load(KEY);
      if (!recipes.some((r) => r.id === id)) return { ok: false, reason: NOT_FOUND_REASON };
      save(KEY, recipes.filter((r) => r.id !== id));
      return { ok: true };
    },

    // ---- 食材の一覧（R8・R9）----

    // 一覧をあいうえお順で返す
    listIngredients() {
      return load(INGREDIENTS_KEY).sort(collator.compare);
    },

    // 打った文字で始まる食材を、あいうえお順で返す（候補。SPEC 第6節第5段階）
    // 何も打っていなければ、何も返さない
    searchIngredients(rawText) {
      const text = rawText.trim();
      if (!text) return [];
      return this.listIngredients().filter((n) => n.startsWith(text));
    },

    // 一覧に1つ足す。足せたら { ok: true, name }、
    // 足せなければ { ok: false, reason } を返す（reason は画面に出す文）
    addIngredient(rawName) {
      const name = rawName.trim();
      if (!name) return { ok: false, reason: "名前を入れてください" };
      if (!NAME_PATTERN.test(name)) {
        return { ok: false, reason: "ひらがなと「ー」だけで入れてください" };
      }
      const list = load(INGREDIENTS_KEY);
      if (list.includes(name)) return { ok: false, reason: `「${name}」はもう一覧にあります` };
      list.push(name);
      save(INGREDIENTS_KEY, list);
      return { ok: true, name };
    },

    // この食材を使っているレシピの名前を返す（使っていなければ空）
    recipesUsing(name) {
      return load(KEY).map(view).filter((r) => r.ingredients.includes(name)).map((r) => this.titleOf(r));
    },

    // 一覧から1つ消す（R9）。次の2つは消さない（SPEC 第6節第5段階）
    //   ・登録画面でいま選んでいる食材（selected に渡す。まだ保存していなくても）
    //   ・保存したレシピで使っている食材
    // 消せたら { ok: true }、消さなかったら { ok: false, reason, usedBy } を返す
    // （reason は画面に出す文、usedBy は使っているレシピの名前）
    removeIngredient(name, selected = []) {
      if (selected.includes(name)) {
        return { ok: false, reason: `「${name}」は選んでいるので消せません。上の「外す」を押してから消してください`, usedBy: [] };
      }
      const usedBy = this.recipesUsing(name);
      if (usedBy.length) {
        return { ok: false, reason: `「${name}」は「${usedBy.join("」「")}」で使っているので消せません`, usedBy };
      }
      save(INGREDIENTS_KEY, load(INGREDIENTS_KEY).filter((n) => n !== name));
      return { ok: true };
    },
  };
}

// アプリが使う窓口（本物の保存場所につなぐ）。tests.html ではこの行は使わない
const Storage = typeof localStorage !== "undefined" ? createStorage(localStorage) : null;
