// テストの本体（SPEC 第7節「確かめ方：テストを先に書く」）
//
// 項目の番号と「確かめること」の文は、claude-code-tutorial の
// projects/recipe/TESTS.md（本人が承認したもの）と同じにしている。
// 表と1行ずつ突き合わせられるようにするため。
//
// どの項目も、毎回まっさらな「偽物の保存場所」を作って、その上だけで動く。
// 本物のレシピ（localStorage）には触らない。

// 偽物の保存場所。localStorage と同じ2つの操作（getItem / setItem）だけを持つ
function createFakeBackend() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    raw: data, // テストから、保存された文字をそのまま覗くため
  };
}

const RECIPES_KEY = "my-recipes:v1";
const INGREDIENTS_KEY = "my-recipes:ingredients:v1";

// 項目を1つずつ書く。check は「合格なら何も起きず、不合格なら理由を投げる」
const TEST_CASES = [];
function item(id, group, what, check) {
  TEST_CASES.push({ id, group, what, check });
}

// 確かめるための小さな道具
function expect(cond, message) {
  if (!cond) throw new Error(message);
}
function same(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}：期待 ${e} ／ 実際 ${a}`);
}
// まっさらな偽物の保存場所と、それにつないだ窓口を作る
function fresh() {
  const backend = createFakeBackend();
  return { backend, s: createStorage(backend) };
}

// ---------- 足す（R8） ----------
const ADD = "足す（R8）";

item("R8-1", ADD, "ひらがなの名前を足せる", () => {
  const { s } = fresh();
  same(s.addIngredient("おくら").ok, true, "「おくら」を足した結果");
  same(s.listIngredients(), ["おくら"], "一覧");
});

item("R8-2", ADD, "長音「ー」を含む名前を足せる", () => {
  const { s } = fresh();
  same(s.addIngredient("ぴーまん").ok, true, "「ぴーまん」を足した結果");
  same(s.listIngredients(), ["ぴーまん"], "一覧");
});

item("R8-3", ADD, "カタカナは足せない", () => {
  const { s } = fresh();
  same(s.addIngredient("オクラ").ok, false, "「オクラ」を足した結果");
  same(s.listIngredients(), [], "一覧");
});

item("R8-4", ADD, "漢字を含む名前は足せない", () => {
  const { s } = fresh();
  same(s.addIngredient("玉ねぎ").ok, false, "「玉ねぎ」を足した結果");
  same(s.listIngredients(), [], "一覧");
});

item("R8-5", ADD, "ひらがなと別の文字が混ざった名前は足せない", () => {
  const { s } = fresh();
  same(s.addIngredient("たまネギ").ok, false, "「たまネギ」を足した結果");
  same(s.listIngredients(), [], "一覧");
});

item("R8-6", ADD, "何も打っていない・空白だけの名前は足せない", () => {
  const { s } = fresh();
  same(s.addIngredient("").ok, false, "「」を足した結果");
  same(s.addIngredient("　").ok, false, "全角の空白を足した結果");
  same(s.addIngredient(" ").ok, false, "半角の空白を足した結果");
  same(s.listIngredients(), [], "一覧");
});

item("R8-7", ADD, "前後の空白は取ってから足す", () => {
  const { s } = fresh();
  const r = s.addIngredient(" とまと ");
  same(r.ok, true, "「 とまと 」を足した結果");
  same(r.name, "とまと", "足した名前");
  same(s.listIngredients(), ["とまと"], "一覧");
});

item("R8-8", ADD, "すでにある名前は足せない", () => {
  const { s } = fresh();
  s.addIngredient("なす");
  same(s.addIngredient("なす").ok, false, "2回目の「なす」を足した結果");
  same(s.listIngredients(), ["なす"], "一覧（なすが1つだけ）");
});

item("R8-9", ADD, "前後に空白を付けても、すでにある名前は足せない", () => {
  const { s } = fresh();
  s.addIngredient("なす");
  same(s.addIngredient(" なす ").ok, false, "「 なす 」を足した結果");
  same(s.listIngredients(), ["なす"], "一覧（なすが1つだけ）");
});

item("R8-10", ADD, "足せなかったときは、理由の文を返す", () => {
  const { s } = fresh();
  same(s.addIngredient("オクラ").reason, "ひらがなと「ー」だけで入れてください", "「オクラ」の理由");
  expect(typeof s.addIngredient("").reason === "string" && s.addIngredient("").reason.length > 0,
    "「」を足したときに理由の文がない");
  s.addIngredient("なす");
  expect(typeof s.addIngredient("なす").reason === "string" && s.addIngredient("なす").reason.length > 0,
    "すでにある名前を足したときに理由の文がない");
});

item("R8-11", ADD, "足した食材は、レシピを登録しなくても一覧に残る", () => {
  const { backend, s } = fresh();
  s.addIngredient("おくら");
  // レシピは登録しない。窓口を作り直して「次に開いたとき」を再現する
  const reopened = createStorage(backend);
  same(reopened.searchIngredients("お"), ["おくら"], "開き直して「お」と打ったときの候補");
});

// ---------- 候補を出す（R8・第6節第5段階） ----------
const SEARCH = "候補を出す（R8・第6節第5段階）";

item("C-1", SEARCH, "打った文字で始まる食材だけを返す", () => {
  const { s } = fresh();
  ["ばなな", "なめこ", "なす"].forEach((n) => s.addIngredient(n));
  same(s.searchIngredients("な"), ["なす", "なめこ"], "「な」の候補（ばななは出ない）");
});

item("C-2", SEARCH, "候補はあいうえお順に並ぶ（濁点の付いた字も辞書の順）", () => {
  const { s } = fresh();
  // わざとばらばらの順に足す
  ["ごぼう", "がんもどき", "おくら", "かぼちゃ"].forEach((n) => s.addIngredient(n));
  same(s.listIngredients(), ["おくら", "かぼちゃ", "がんもどき", "ごぼう"], "一覧の順");
});

item("C-3", SEARCH, "何も打っていない・空白だけのときは、候補を返さない", () => {
  const { s } = fresh();
  ["なす", "おくら"].forEach((n) => s.addIngredient(n));
  same(s.searchIngredients(""), [], "「」の候補");
  same(s.searchIngredients("　"), [], "全角の空白の候補");
  same(s.searchIngredients(" "), [], "半角の空白の候補");
});

item("C-4", SEARCH, "打った名前と同じ名前も候補に入る", () => {
  const { s } = fresh();
  s.addIngredient("なす");
  same(s.searchIngredients("なす"), ["なす"], "「なす」の候補");
});

item("C-5", SEARCH, "「とうふ」で「きぬどうふ」「もめんどうふ」は出ない", () => {
  const { s } = fresh();
  ["きぬどうふ", "もめんどうふ", "とうふ"].forEach((n) => s.addIngredient(n));
  same(s.searchIngredients("とうふ"), ["とうふ"], "「とうふ」の候補");
});

// ---------- 消す（R9） ----------
const REMOVE = "消す（R9）";

item("R9-1", REMOVE, "どのレシピにも使っていない食材は、確認なしで消える", () => {
  const { s } = fresh();
  s.addIngredient("ぴーまん");
  same(s.removeIngredient("ぴーまん").ok, true, "「ぴーまん」を消した結果");
  same(s.listIngredients(), [], "一覧");
});

item("R9-2", REMOVE, "レシピで使っている食材は消えない", () => {
  const { s } = fresh();
  s.addIngredient("なす");
  s.addRecipe({ title: "麻婆なす", body: "", ingredients: ["なす"] });
  same(s.removeIngredient("なす").ok, false, "「なす」を消した結果");
  same(s.listIngredients(), ["なす"], "一覧");
});

item("R9-3", REMOVE, "消せないときは、使っているレシピの名前を返す", () => {
  const { s } = fresh();
  s.addIngredient("なす");
  s.addRecipe({ title: "麻婆なす", body: "", ingredients: ["なす"] });
  const r = s.removeIngredient("なす");
  same(r.usedBy, ["麻婆なす"], "使っているレシピ");
  expect(r.reason.includes("麻婆なす"), `画面に出す文にレシピの名前がない：${r.reason}`);
});

item("R9-4", REMOVE, "登録画面でいま選んでいる食材は消えない（まだ保存していなくても）", () => {
  const { s } = fresh();
  s.addIngredient("おくら");
  // 「おくら」を選んでいるが、レシピはまだ保存していない
  same(s.removeIngredient("おくら", ["おくら"]).ok, false, "選んでいる「おくら」を消した結果");
  same(s.listIngredients(), ["おくら"], "一覧");
});

// ---------- レシピに付ける（R2）とデータの持ち方 ----------
const RECIPE = "レシピに付ける（R2）とデータの持ち方";

item("R2-1", RECIPE, "食材を付けてレシピを登録でき、読むと同じ食材が返る", () => {
  const { s } = fresh();
  const id = s.addRecipe({ title: "なすの炒め物", body: "", ingredients: ["なす", "ぶたこま"] });
  same(s.getRecipe(id).ingredients, ["なす", "ぶたこま"], "読んだときの食材");
});

item("R2-2", RECIPE, "レシピには食材を名前で覚える", () => {
  const { backend, s } = fresh();
  s.addRecipe({ title: "なすの炒め物", body: "", ingredients: ["なす"] });
  const saved = JSON.parse(backend.raw.get(RECIPES_KEY));
  same(saved[0].ingredients, ["なす"], "保存されたデータの食材");
});

item("R2-3", RECIPE, "食材を1つも付けずに登録できる", () => {
  const { s } = fresh();
  const id = s.addRecipe({ title: "白ごはん", body: "", ingredients: [] });
  const r = s.getRecipe(id);
  expect(r !== null, "登録したレシピが読めない");
  same(r.ingredients, [], "読んだときの食材（食材なし）");
});

// 最初の1本（6ec791b）で登録したレシピの形。食材の欄がない
const OLD_RECIPE = { id: "old1", title: "古いレシピ", body: "本文", createdAt: 1 };

item("D-1", RECIPE, "食材の欄がない古いレシピは「食材なし」として読める", () => {
  const { backend, s } = fresh();
  backend.setItem(RECIPES_KEY, JSON.stringify([OLD_RECIPE]));
  same(s.getRecipe("old1").ingredients, [], "1件を読んだときの食材");
  same(s.listRecipes()[0].ingredients, [], "一覧で読んだときの食材");
});

item("D-2", RECIPE, "古いレシピを読んでも、保存されたデータは書き換わらない", () => {
  const { backend, s } = fresh();
  backend.setItem(RECIPES_KEY, JSON.stringify([OLD_RECIPE]));
  const before = backend.getItem(RECIPES_KEY);
  s.getRecipe("old1");
  s.listRecipes();
  s.recipesUsing("なす");
  same(backend.getItem(RECIPES_KEY), before, "読む前と後の保存されたデータ");
});

item("D-3", RECIPE, "新しいレシピを登録しても、古いレシピに食材の欄は書き足されない", () => {
  const { backend, s } = fresh();
  backend.setItem(RECIPES_KEY, JSON.stringify([OLD_RECIPE]));
  s.addRecipe({ title: "新しいレシピ", body: "", ingredients: ["なす"] });
  const saved = JSON.parse(backend.getItem(RECIPES_KEY));
  const old = saved.find((r) => r.id === "old1");
  same(old, OLD_RECIPE, "登録の後の古いレシピ");
  same(saved.length, 2, "保存されたレシピの数");
});

// ---------- 全部を流す ----------
// realBackend を渡すと、T-1（本物の保存場所が変わっていないか）も確かめる。
// 渡さなければ（ブラウザの外で流すとき）T-1 は「確かめられない」とする
function runAllTests(realBackend) {
  const snapshot = () => realBackend
    ? JSON.stringify([realBackend.getItem(RECIPES_KEY), realBackend.getItem(INGREDIENTS_KEY)])
    : null;
  const before = snapshot();

  const results = TEST_CASES.map((t) => {
    try {
      t.check();
      return { id: t.id, group: t.group, what: t.what, status: "pass" };
    } catch (e) {
      return { id: t.id, group: t.group, what: t.what, status: "fail", detail: e.message };
    }
  });

  const SAFETY = "テストそのものの安全";
  const t1 = "テストを流す前と後で、本物の保存場所（レシピ・食材の一覧）が変わっていない";
  if (!realBackend) {
    results.push({ id: "T-1", group: SAFETY, what: t1, status: "skip", detail: "ブラウザの外なので本物の保存場所がない" });
  } else if (snapshot() === before) {
    results.push({ id: "T-1", group: SAFETY, what: t1, status: "pass" });
  } else {
    results.push({ id: "T-1", group: SAFETY, what: t1, status: "fail", detail: "テストの前と後で本物の保存場所の中身が違う" });
  }
  return results;
}
