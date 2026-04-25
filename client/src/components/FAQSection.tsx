const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "How much does it cost to remove a tree?",
    answer:
      "Tree removal costs vary depending on the size, location, condition and accessibility of the tree, as well as whether stump grinding or debris removal is included. Smaller trees in open areas are quick and affordable, while large trees near buildings or powerlines require more time, equipment and care. We provide a clear, itemised quote so you know exactly what's included before any work begins.",
  },
  {
    question: "Do you provide free quotes?",
    answer:
      "Yes — all quotes are free and no-obligation. We'll visit your property, assess the job in person, and walk you through our recommendations. You can request a quote through our website, by phone, or by email.",
  },
  {
    question: "Do I need council permission to remove a tree?",
    answer:
      "In some cases, yes. Gisborne District Council has rules around removing certain trees, particularly notable, heritage or protected species, and trees in specific zones. Before removing any significant tree, we recommend checking with the council or asking us — we can help guide you through the process and let you know if a resource consent is needed.",
  },
  {
    question: "Are there protected trees in the area?",
    answer:
      "Yes. Some trees in the Gisborne region are protected under the District Plan, including notable trees and certain native species. Protections can apply based on size, species, location or heritage status. If you're unsure about a tree on your property, we can help identify whether it's protected before any work is planned.",
  },
  {
    question: "Can I prune a neighbour's tree that's overhanging my property?",
    answer:
      "Generally, you have the right to trim branches that overhang your property up to the boundary line, provided the tree isn't protected. However, it's always best to talk to your neighbour first and avoid causing damage to the health of the tree. We're happy to carry out boundary pruning professionally and can advise on what's reasonable before starting any work.",
  },
  {
    question: "Are you fully insured?",
    answer:
      "Yes — we carry full public liability insurance for every job we do. This covers your property and gives you peace of mind that the work is being carried out by a properly insured business. We're happy to provide a copy of our certificate of currency on request.",
  },
  {
    question: "Are your arborists qualified?",
    answer:
      "Absolutely. Our team holds recognised arboricultural qualifications and relevant industry certifications, and we keep our skills current through ongoing training. This means safer work, better outcomes for your trees, and confidence that the job is being done right.",
  },
  {
    question: "What happens if something gets damaged on my property?",
    answer:
      "We take every precaution to protect your property — including using rigging, drop zones and ground protection where needed. In the unlikely event that something is damaged during our work, our public liability insurance covers it. We'll also notify you straight away and work with you to put it right.",
  },
];

const FAQ_STYLES = `
  .tm-faq-section {
    background: #FFFFFF;
    padding: 48px 24px;
    font-family: var(--font-sans);
  }
  .tm-faq-header {
    text-align: center;
    margin-bottom: 32px;
  }
  .tm-faq-eyebrow {
    font-size: 11px;
    color: #3B6D11;
    letter-spacing: 0.12em;
    font-weight: 600;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  .tm-faq-title {
    font-size: 26px;
    font-weight: 600;
    color: #173404;
    margin: 0 0 10px;
    letter-spacing: 0.01em;
  }
  .tm-faq-subtitle {
    font-size: 14px;
    color: #27500A;
    margin: 0 auto;
    max-width: 520px;
    line-height: 1.5;
  }
  .tm-faq-list {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tm-faq-item {
    background: #FFFFFF;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(23, 52, 4, 0.12);
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .tm-faq-item[open] {
    box-shadow: 0 2px 10px rgba(23, 52, 4, 0.08);
    border-color: rgba(23, 52, 4, 0.18);
  }
  .tm-faq-question {
    padding: 16px 20px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
    color: #173404;
    display: flex;
    align-items: center;
    justify-content: space-between;
    list-style: none;
    user-select: none;
  }
  .tm-faq-question::-webkit-details-marker {
    display: none;
  }
  .tm-faq-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #DCEFC8;
    color: #3B6D11;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    flex-shrink: 0;
    margin-left: 16px;
    transition: transform 0.2s, background 0.2s;
  }
  .tm-faq-item[open] .tm-faq-icon {
    background: #639922;
    color: #FFFFFF;
    transform: rotate(45deg);
  }
  .tm-faq-answer {
    padding: 0 20px 18px;
    font-size: 13.5px;
    color: #27500A;
    line-height: 1.6;
  }
  .tm-faq-cta {
    text-align: center;
    margin-top: 28px;
    font-size: 13px;
    color: #27500A;
  }
  .tm-faq-cta a {
    color: #3B6D11;
    font-weight: 600;
    text-decoration: underline;
  }
`;

export default function FAQSection() {
  return (
    <section className="w-full" data-testid="section-faq">
      <style>{FAQ_STYLES}</style>
      <h2 className="sr-only">
        Frequently asked questions section for an arborist business with eight collapsible questions on a white background.
      </h2>
      <div className="tm-faq-section">
        <div className="tm-faq-header">
          <div className="tm-faq-eyebrow">FAQs</div>
          <h2 className="tm-faq-title">Frequently asked questions</h2>
          <p className="tm-faq-subtitle">
            Answers to the questions Gisborne homeowners ask us most often.
          </p>
        </div>

        <div className="tm-faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <details className="tm-faq-item" key={i} data-testid={`faq-item-${i}`}>
              <summary className="tm-faq-question">
                <span>{item.question}</span>
                <span className="tm-faq-icon" aria-hidden="true">+</span>
              </summary>
              <div className="tm-faq-answer">{item.answer}</div>
            </details>
          ))}
        </div>

        <div className="tm-faq-cta">
          Still have questions? <a href="#contact">Get in touch</a> — we're happy to help.
        </div>
      </div>
    </section>
  );
}
