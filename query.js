// 絞り込みの条件を、画面の住所（URL）の # の後ろに書く／読み戻す
// （SPEC 第6節第7段階「作り方」）
//
// 例：欄1「とうふ・きぬどうふ」、欄2「ぶたこま」
//   → #/?1=とうふ,きぬどうふ&2=ぶたこま
// PubMed の検索結果の URL に検索式が入っているのと同じ考え方。
// 住所に条件が書いてあるので、スワイプで「1つ前の住所」に戻れば条件も戻る。
//
// 住所に日本語をそのまま入れると、ブラウザによって「%E3%81%A8…」の形に置き換えられる。
// そこで書くときは自分で置き換えておき、読むときは元に戻す（どちらの形で返ってきても読める）。
//
// 条件は [欄1の食材, 欄2の食材] の形で持つ。例：[["とうふ", "きぬどうふ"], ["ぶたこま"]]
// このファイルはデータに触らない（保存の窓口 storage.js とは別）。

const Query = {
  // 条件 → 住所。両方の欄が空なら、条件のない一覧 #/
  toHash(fields) {
    const parts = [];
    fields.forEach((names, i) => {
      if (names.length) parts.push(`${i + 1}=${names.map(encodeURIComponent).join(",")}`);
    });
    return parts.length ? `#/?${parts.join("&")}` : "#/";
  },

  // 住所 → 条件。読めない形の住所は、絞り込みなし（両方空）として扱う
  fromHash(hash) {
    const empty = [[], []];
    if (!hash.startsWith("#/?")) return empty;
    const fields = [[], []];
    const seen = new Set();
    try {
      for (const part of hash.slice(3).split("&")) {
        const eq = part.indexOf("=");
        const key = part.slice(0, eq);
        // 「1=…」「2=…」以外の形や、同じ欄が2回書いてある住所は読めないものとする
        if (eq === -1 || (key !== "1" && key !== "2") || seen.has(key)) return empty;
        seen.add(key);
        const names = part.slice(eq + 1).split(",").map(decodeURIComponent).filter((n) => n);
        fields[Number(key) - 1] = [...new Set(names)];
      }
    } catch (e) {
      // 「%E3%81」のように途中で切れた置き換えは、元に戻せずここに来る
      return empty;
    }
    return fields;
  },
};
