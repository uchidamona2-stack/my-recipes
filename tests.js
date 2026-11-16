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
// まっさらな偽物の保存場所と、それにつないだ窓口を作る。
// 時計も偽物にする（保存するたびに1ずつ進む）。本物の時計だと、テストは速すぎて
// 2件の保存が同じ1000分の1秒に重なり、どちらが後か決まらないことがあるため
function fresh() {
  const backend = createFakeBackend();
  let t = 1000;
  return { backend, s: createStorage(backend, () => ++t) };
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
  const { id } = s.addRecipe({ title: "なすの炒め物", body: "", ingredients: ["なす", "ぶたこま"] });
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
  const { id } = s.addRecipe({ title: "白ごはん", body: "", ingredients: [] });
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

// ---------- 名前が空のレシピ（R1・R10） ----------
const NONAME = "名前が空のレシピ（R1・R10）";
const raw = (backend) => JSON.parse(backend.getItem(RECIPES_KEY) || "[]");

item("N-1", NONAME, "名前が空でも、材料と手順か食材のどちらかがあれば登録できる", () => {
  const { s } = fresh();
  same(s.addRecipe({ title: "", body: "なすを切る", ingredients: [] }).ok, true, "名前なし・本文ありの登録");
  same(s.addRecipe({ title: "", body: "", ingredients: ["なす"] }).ok, true, "名前なし・食材ありの登録");
  same(s.listRecipes().length, 2, "レシピの数");
});

item("N-2", NONAME, "名前が空のレシピは、データには名前を空のまま入れる", () => {
  const { backend, s } = fresh();
  s.addRecipe({ title: "", body: "なすを切る", ingredients: [] });
  same(raw(backend)[0].title, "", "保存されたデータの名前");
});

item("N-3", NONAME, "名前が空のレシピは、画面に出す名前が「（名前なし）」になる", () => {
  const { s } = fresh();
  const a = s.addRecipe({ title: "", body: "なすを切る", ingredients: [] }).id;
  const b = s.addRecipe({ title: "麻婆なす", body: "", ingredients: [] }).id;
  same(s.titleOf(s.getRecipe(a)), "（名前なし）", "名前が空のレシピ");
  same(s.titleOf(s.getRecipe(b)), "麻婆なす", "名前のあるレシピ");
});

item("N-4", NONAME, "空白だけの名前は、空として保存する", () => {
  const { backend, s } = fresh();
  s.addRecipe({ title: "　", body: "なすを切る", ingredients: [] });
  same(raw(backend)[0].title, "", "保存されたデータの名前");
});

item("N-5", NONAME, "名前・材料と手順・食材が全部空なら、登録しない", () => {
  const { s } = fresh();
  same(s.addRecipe({ title: "", body: "", ingredients: [] }).ok, false, "全部空の登録");
  same(s.listRecipes().length, 0, "レシピの数");
});

item("N-6", NONAME, "空白や改行だけの欄も、全部空の判定では空とみなす", () => {
  const { s } = fresh();
  same(s.addRecipe({ title: " ", body: "\n\n　\n", ingredients: [] }).ok, false, "空白と改行だけの登録");
  same(s.listRecipes().length, 0, "レシピの数");
});

item("N-7", NONAME, "全部空で登録しなかったときは、理由の文を返す", () => {
  const { s } = fresh();
  same(s.addRecipe({ title: "", body: "", ingredients: [] }).reason, "何も入っていないので、保存していません", "理由の文");
});

// ---------- 直す（R10） ----------
const EDIT = "直す（R10）";

// 3件を古い順に登録しておく
function threeRecipes() {
  const f = fresh();
  f.s.addIngredient("なす");
  f.s.addIngredient("ぶたこま");
  f.ids = [
    f.s.addRecipe({ title: "まーぼなす", body: "なすを切る", ingredients: ["なす"] }).id,
    f.s.addRecipe({ title: "白ごはん", body: "米を炊く", ingredients: [] }).id,
    f.s.addRecipe({ title: "みそ汁", body: "だしをとる", ingredients: [] }).id,
  ];
  return f;
}
const order = (s) => s.listRecipes().map((r) => r.title);

item("R10-1", EDIT, "名前を直して保存すると、読むと直した名前が返る", () => {
  const { s, ids } = threeRecipes();
  same(s.updateRecipe(ids[0], { title: "麻婆なす", body: "なすを切る", ingredients: ["なす"] }).ok, true, "直した結果");
  same(s.getRecipe(ids[0]).title, "麻婆なす", "読んだ名前");
});

item("R10-2", EDIT, "材料と手順を直して保存すると、読むと直した本文が返る", () => {
  const { s, ids } = threeRecipes();
  s.updateRecipe(ids[0], { title: "まーぼなす", body: "なすを乱切りにする", ingredients: ["なす"] });
  same(s.getRecipe(ids[0]).body, "なすを乱切りにする", "読んだ本文");
});

item("R10-3", EDIT, "食材を付け替えて保存すると、読むと付け替えた食材が返る", () => {
  const { s, ids } = threeRecipes();
  s.updateRecipe(ids[0], { title: "まーぼなす", body: "なすを切る", ingredients: ["なす", "ぶたこま"] });
  same(s.getRecipe(ids[0]).ingredients, ["なす", "ぶたこま"], "読んだ食材");
});

item("R10-4", EDIT, "直しても、レシピの件数は増えない（別のレシピとして足されない）", () => {
  const { s, ids } = threeRecipes();
  s.updateRecipe(ids[0], { title: "麻婆なす", body: "なすを切る", ingredients: ["なす"] });
  same(s.listRecipes().length, 3, "レシピの数");
});

item("R10-5", EDIT, "直したレシピ以外は変わらない", () => {
  const { backend, s, ids } = threeRecipes();
  const others = () => JSON.stringify(raw(backend).filter((r) => r.id !== ids[0]));
  const before = others();
  s.updateRecipe(ids[0], { title: "麻婆なす", body: "なすを切る", ingredients: ["なす"] });
  same(others(), before, "ほかの2件のデータ");
});

item("R10-6", EDIT, "直して保存したレシピは、一覧の一番上に動く", () => {
  const { s, ids } = threeRecipes();
  same(order(s), ["みそ汁", "白ごはん", "まーぼなす"], "直す前の並び");
  s.updateRecipe(ids[0], { title: "麻婆なす", body: "なすを切る", ingredients: ["なす"] });
  same(order(s), ["麻婆なす", "みそ汁", "白ごはん"], "直した後の並び");
});

item("R10-6a", EDIT, "新しく登録したレシピも一番上に来る（直したレシピより後なら、その上）", () => {
  const { s, ids } = threeRecipes();
  s.updateRecipe(ids[0], { title: "麻婆なす", body: "なすを切る", ingredients: ["なす"] });
  s.addRecipe({ title: "やきそば", body: "", ingredients: [] });
  same(order(s), ["やきそば", "麻婆なす", "みそ汁", "白ごはん"], "並び");
});

item("R10-6b", EDIT, "直したことのない古いレシピは、登録した日時の順に並び、データは書き換わらない", () => {
  const { backend, s } = fresh();
  const OLD_A = { id: "a", title: "古いA", body: "", createdAt: 1 };
  const OLD_B = { id: "b", title: "古いB", body: "", createdAt: 2 };
  backend.setItem(RECIPES_KEY, JSON.stringify([OLD_A, OLD_B]));
  const before = backend.getItem(RECIPES_KEY);
  same(order(s), ["古いB", "古いA"], "並び");
  same(backend.getItem(RECIPES_KEY), before, "並べる前と後の保存されたデータ");
});

item("R10-6c", EDIT, "保存しなかったとき（全部空など）は、並び順も変わらない", () => {
  const { s, ids } = threeRecipes();
  s.updateRecipe(ids[0], { title: "", body: "", ingredients: [] });
  same(order(s), ["みそ汁", "白ごはん", "まーぼなす"], "並び");
});

item("R10-7", EDIT, "直して名前を空にしても、ほかの欄があれば保存でき、「（名前なし）」になる", () => {
  const { s, ids } = threeRecipes();
  same(s.updateRecipe(ids[0], { title: "", body: "なすを切る", ingredients: ["なす"] }).ok, true, "直した結果");
  same(s.titleOf(s.getRecipe(ids[0])), "（名前なし）", "画面に出す名前");
});

item("R10-8", EDIT, "直して全部空にしたら保存せず、保存されたレシピは元のまま", () => {
  const { backend, s, ids } = threeRecipes();
  const before = backend.getItem(RECIPES_KEY);
  const r = s.updateRecipe(ids[0], { title: " ", body: "\n", ingredients: [] });
  same(r.ok, false, "直した結果");
  same(r.reason, "何も入っていないので、保存していません", "理由の文");
  same(backend.getItem(RECIPES_KEY), before, "保存されたデータ");
});

item("R10-9", EDIT, "食材を外して保存すると、外した食材は一覧に残る", () => {
  const { s, ids } = threeRecipes();
  s.updateRecipe(ids[0], { title: "まーぼなす", body: "なすを切る", ingredients: [] });
  expect(s.listIngredients().includes("なす"), "一覧から「なす」がなくなった");
});

item("R10-10", EDIT, "外した食材は、ほかで使っていなければ消せるようになる", () => {
  const { s, ids } = threeRecipes();
  same(s.removeIngredient("なす").ok, false, "外す前に「なす」を消した結果");
  s.updateRecipe(ids[0], { title: "まーぼなす", body: "なすを切る", ingredients: [] });
  same(s.removeIngredient("なす").ok, true, "外した後に「なす」を消した結果");
});

item("R10-11", EDIT, "食材の欄がない古いレシピに、食材を付けて保存できる", () => {
  const { backend, s } = fresh();
  backend.setItem(RECIPES_KEY, JSON.stringify([OLD_RECIPE]));
  s.addIngredient("なす");
  same(s.updateRecipe("old1", { title: "古いレシピ", body: "本文", ingredients: ["なす"] }).ok, true, "直した結果");
  same(s.getRecipe("old1").ingredients, ["なす"], "読んだ食材");
});

item("R10-12", EDIT, "古いレシピを直しても、ほかの古いレシピは書き換わらない", () => {
  const { backend, s } = fresh();
  const OLD_2 = { id: "old2", title: "古いレシピ2", body: "本文2", createdAt: 2 };
  backend.setItem(RECIPES_KEY, JSON.stringify([OLD_RECIPE, OLD_2]));
  s.updateRecipe("old1", { title: "古いレシピ", body: "本文", ingredients: ["なす"] });
  same(raw(backend).find((r) => r.id === "old2"), OLD_2, "もう1件の古いレシピ");
});

item("R10-13", EDIT, "ないレシピを直そうとしたら、何も変わらず、理由の文を返す", () => {
  const { backend, s } = threeRecipes();
  const before = backend.getItem(RECIPES_KEY);
  const r = s.updateRecipe("nai", { title: "麻婆なす", body: "", ingredients: [] });
  same(r.ok, false, "直した結果");
  same(r.reason, "レシピが見つかりません", "理由の文");
  same(backend.getItem(RECIPES_KEY), before, "保存されたデータ");
});

// ---------- 消す（R11） ----------
const DELETE = "消す（R11）";

item("R11-1", DELETE, "消したレシピは、読もうとしても見つからない", () => {
  const { s, ids } = threeRecipes();
  same(s.deleteRecipe(ids[0]).ok, true, "消した結果");
  same(s.getRecipe(ids[0]), null, "消したあと読んだ結果");
});

item("R11-2", DELETE, "消したレシピは、一覧に出ない", () => {
  const { s, ids } = threeRecipes();
  s.deleteRecipe(ids[0]);
  same(order(s), ["みそ汁", "白ごはん"], "一覧");
});

item("R11-3", DELETE, "消したレシピ以外は変わらない", () => {
  const { backend, s, ids } = threeRecipes();
  const others = () => JSON.stringify(raw(backend).filter((r) => r.id !== ids[0]));
  const before = others();
  s.deleteRecipe(ids[0]);
  same(others(), before, "残りの2件のデータ");
});

item("R11-4", DELETE, "消したレシピで使っていた食材は、一覧に残る", () => {
  const { s, ids } = threeRecipes();
  s.deleteRecipe(ids[0]);
  expect(s.listIngredients().includes("なす"), "一覧から「なす」がなくなった");
});

item("R11-5", DELETE, "消したレシピだけで使っていた食材は、消せるようになる", () => {
  const { s, ids } = threeRecipes();
  s.deleteRecipe(ids[0]);
  same(s.removeIngredient("なす").ok, true, "「なす」を消した結果");
});

item("R11-6", DELETE, "ほかのレシピでも使っている食材は、消したあとも消せない", () => {
  const { s, ids } = threeRecipes();
  s.addRecipe({ title: "なすの漬物", body: "", ingredients: ["なす"] });
  s.deleteRecipe(ids[0]);
  const r = s.removeIngredient("なす");
  same(r.ok, false, "「なす」を消した結果");
  same(r.usedBy, ["なすの漬物"], "使っているレシピ");
});

item("R11-7", DELETE, "ないレシピを消そうとしても、ほかは何も変わらない", () => {
  const { backend, s } = threeRecipes();
  const before = backend.getItem(RECIPES_KEY);
  same(s.deleteRecipe("nai").ok, false, "消した結果");
  same(backend.getItem(RECIPES_KEY), before, "保存されたデータ");
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
