const contextTags = ["Valencia", "MERCURI", "Erasmus community"];
const resourceTags = ["Room", "Bicycle", "Furniture", "Giveaway"];

export default function HomePage() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Arriving soon? Leaving soon?</p>
        <h1 id="hero-title">Pass useful things forward.</h1>
        <p className="lede">
          One place to hand over rooms and everyday items across international
          communities—without digging through scattered group messages.
        </p>
        <div className="tag-demo" aria-label="Example listing tags">
          <div>
            <span className="tag-label">City & community</span>
            <div className="tags">
              {contextTags.map((tag) => <span className="tag context" key={tag}>{tag}</span>)}
            </div>
          </div>
          <div>
            <span className="tag-label">Housing & items</span>
            <div className="tags">
              {resourceTags.map((tag) => <span className="tag resource" key={tag}>{tag}</span>)}
            </div>
          </div>
        </div>
        <p className="status">Foundation ready · marketplace flows coming next</p>
      </section>
    </main>
  );
}
