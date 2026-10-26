// 保存の窓口（SPEC 第7節「保存を1か所に閉じ込める」）
//
// レシピの保存と取り出しは、すべてこのファイルを通す。
// ほかのファイルは localStorage に直接触らない。
// 保存のしかたを変えるときは、このファイルだけを直す。
//
// いまの保存先：localStorage（ブラウザが、このサイト専用に iPhone の中に用意する保存場所）

const Storage = (() => {
  const KEY = "my-recipes:v1";

  function readAll() {
    try {
      const text = localStorage.getItem(KEY);
      return text ? JSON.parse(text) : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(recipes) {
    localStorage.setItem(KEY, JSON.stringify(recipes));
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    // 登録したレシピをすべて返す（新しい順）
    listRecipes() {
      return readAll().sort((a, b) => b.createdAt - a.createdAt);
    },

    // id で1件を返す。見つからなければ null
    getRecipe(id) {
      return readAll().find((r) => r.id === id) || null;
    },

    // 1件を登録し、つけた id を返す
    addRecipe({ title, body }) {
      const recipes = readAll();
      const recipe = { id: newId(), title, body, createdAt: Date.now() };
      recipes.push(recipe);
      writeAll(recipes);
      return recipe.id;
    },
  };
})();
