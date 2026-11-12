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
// 保存しているもの（SPEC 第6節第5段階「データの持ち方」）
//   レシピ     … { id, title, body, createdAt, ingredients: ["おくら", "なす"] }
//   食材の一覧 … ["おくら", "なす", …]（名前だけを持つ。番号は付けない）

function createStorage(backend) {
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
  // 保存されたデータそのものは書き換えない（SPEC 第6節第5段階）。
  function view(recipe) {
    return { ...recipe, ingredients: recipe.ingredients || [] };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    // ---- レシピ ----

    // 登録したレシピをすべて返す（新しい順）
    listRecipes() {
      return load(KEY).map(view).sort((a, b) => b.createdAt - a.createdAt);
    },

    // id で1件を返す。見つからなければ null
    getRecipe(id) {
      const r = load(KEY).find((r) => r.id === id);
      return r ? view(r) : null;
    },

    // 1件を登録し、つけた id を返す
    addRecipe({ title, body, ingredients }) {
      const recipes = load(KEY);
      const recipe = { id: newId(), title, body, createdAt: Date.now(), ingredients };
      recipes.push(recipe);
      save(KEY, recipes);
      return recipe.id;
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
      return load(KEY).map(view).filter((r) => r.ingredients.includes(name)).map((r) => r.title);
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
