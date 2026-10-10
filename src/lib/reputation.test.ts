import { describe, expect, it } from "vitest";
import reviewsCache from "@/data/cache/reviews.json";
import { scoreReputation, type ScorableReview } from "./reputation";

function r(rating: number | null, complaintType: ScorableReview["complaintType"] = "none", extra: Partial<ScorableReview> = {}): ScorableReview {
  return {
    about: "supplier",
    rating,
    complaintType,
    quote: `Review ${Math.random()}`,
    url: "https://example.com",
    ...extra,
  };
}

type CacheEntries = Record<string, { about: "supplier" | "product"; reviews: ScorableReview[] }>;
const cache = (reviewsCache as unknown as { entries: CacheEntries }).entries;

describe("scoreReputation", () => {
  it("returns not_enough with fewer than 3 reviews", () => {
    const s = scoreReputation([r(5), r(1, "fraud")], "supplier");
    expect(s.flag).toBe("not_enough");
    expect(s.reviews).toHaveLength(2);
  });

  it("drops duplicates before counting", () => {
    const dup = { quote: "Slow warranty, five weeks!" };
    const s = scoreReputation([r(4, "warranty", dup), r(4, "warranty", { quote: "slow warranty five weeks" }), r(5)], "supplier");
    expect(s.reviews).toHaveLength(2);
    expect(s.flag).toBe("not_enough");
  });

  it("drops reviews about another subject or marked irrelevant", () => {
    const s = scoreReputation(
      [r(5), r(5), r(1, "fraud", { about: "product" }), r(1, "fraud", { relevant: false }), r(4)],
      "supplier",
    );
    expect(s.reviews).toHaveLength(3);
    expect(s.flag).toBe("good");
  });

  it("any fraud complaint is a red flag even with high ratings", () => {
    expect(scoreReputation([r(5), r(5), r(5), r(5, "fraud")], "supplier").flag).toBe("red");
  });

  it("average below 3 is a red flag", () => {
    expect(scoreReputation([r(2), r(3), r(2.5)], "supplier").flag).toBe("red");
  });

  it("3 or more serious complaints is a red flag", () => {
    const s = scoreReputation([r(5, "delivery"), r(5, "warranty"), r(4, "delivery"), r(5)], "supplier");
    expect(s.seriousCount).toBe(3);
    expect(s.flag).toBe("red");
  });

  it("quality/service complaints are not serious", () => {
    expect(scoreReputation([r(4, "quality"), r(4, "service"), r(4, "quality"), r(5, "service")], "supplier").flag).toBe("good");
  });

  it("average >= 4 with at most 1 serious complaint is good", () => {
    expect(scoreReputation([r(4), r(4), r(4, "delivery")], "supplier").flag).toBe("good");
  });

  it("average >= 4 with 2 serious complaints is mixed", () => {
    expect(scoreReputation([r(5, "warranty"), r(4, "delivery"), r(4)], "supplier").flag).toBe("mixed");
  });

  it("average between 3 and 4 is mixed", () => {
    const s = scoreReputation([r(3), r(4), r(3)], "supplier");
    expect(s.averageRating).toBeCloseTo(3.33, 2);
    expect(s.flag).toBe("mixed");
  });

  it("no ratings and no serious complaints is mixed (cannot be good without ratings)", () => {
    const s = scoreReputation([r(null), r(null), r(null)], "supplier");
    expect(s.averageRating).toBeNull();
    expect(s.flag).toBe("mixed");
  });

  describe("cached demo reviews", () => {
    it("Al-Noor (supplier A) is mixed: slow warranty service, duplicate dropped", () => {
      const s = scoreReputation(cache["al noor industrial machines"].reviews, "supplier");
      expect(s.reviews).toHaveLength(7);
      expect(s.seriousCount).toBe(2);
      expect(s.flag).toBe("mixed");
    });

    it("Madina (supplier B) is good", () => {
      expect(scoreReputation(cache["madina sewing solutions"].reviews, "supplier").flag).toBe("good");
    });

    it("Karachi Garment Tech has not enough reviews", () => {
      expect(scoreReputation(cache["karachi garment tech"].reviews, "supplier").flag).toBe("not_enough");
    });

    it("JUKI AMS-221F model is good, irrelevant AMS-210 review dropped", () => {
      const s = scoreReputation(cache["juki ams 221f"].reviews, "product");
      expect(s.reviews).toHaveLength(6);
      expect(s.flag).toBe("good");
    });
  });
});
