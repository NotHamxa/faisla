"use client";
// Printable Supplier A quotation (fictional). The team prints and photographs it for the live demo;
// extraction should produce demoQuotation. Standalone: no store, no shared state.
import { DEMO_ITEM, DEMO_MODEL, demoQuotation } from "@/lib/demoData";
import { groupPKR } from "@/lib/format";

const q = demoQuotation;
const item = q.items[0];

export default function DemoQuotationPage() {
  return (
    <main className="min-h-screen bg-neutral-200 px-4 py-8 print:bg-white print:p-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <p className="text-sm text-neutral-600">Demo data — fictional quotation for the Faisla demo. Print on A4, then photograph it.</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Print
        </button>
      </div>

      <article
        className="relative mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white px-[16mm] py-[14mm] text-[13px] leading-relaxed text-neutral-900 shadow-xl print:shadow-none"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-6 border-b-4 border-double border-[#1d3a6e] pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-[#1d3a6e] text-2xl font-bold text-[#1d3a6e]">
              AN
            </div>
            <div>
              <h1 className="text-[26px] font-bold uppercase leading-tight tracking-wide text-[#1d3a6e]">
                Al-Noor Industrial Machines
              </h1>
              <p className="text-[15px] text-[#1d3a6e]" dir="rtl" lang="ur">
                النور انڈسٹریل مشینز
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-neutral-600">
                Importers &amp; Dealers · Industrial Sewing Machines · Spare Parts · Service
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right text-[11.5px] leading-snug text-neutral-700">
            <p>Shop 14-B, Kotwali Road Machinery Market</p>
            <p>Near Clock Tower, Faisalabad, Pakistan</p>
            <p>Ph: {q.supplierPhone}</p>
            <p>Email: {q.supplierEmail}</p>
            <p>NTN: 4217736-8</p>
          </div>
        </header>

        {/* Reference block */}
        <section className="mt-6 flex justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">To</p>
            <p className="font-semibold">M/s Hamza Garments</p>
            <p>Sargodha Road, Faisalabad</p>
            <p>Attn: Mr. Hamza (Proprietor)</p>
          </div>
          <table className="self-start text-[12.5px]">
            <tbody>
              <tr>
                <td className="pr-3 text-neutral-500">Quotation No.</td>
                <td className="font-semibold">ANIM/Q/2026/0412</td>
              </tr>
              <tr>
                <td className="pr-3 text-neutral-500">Date</td>
                <td className="font-semibold">08-Oct-2026</td>
              </tr>
              <tr>
                <td className="pr-3 text-neutral-500">Your Ref.</td>
                <td>Telephonic enquiry</td>
              </tr>
            </tbody>
          </table>
        </section>

        <h2 className="mt-6 text-center text-[17px] font-bold uppercase tracking-[0.25em] underline underline-offset-4">
          Quotation
        </h2>
        <p className="mt-3">
          Dear Sir, with reference to your enquiry we are pleased to quote our best prices for the following:
        </p>

        {/* Items */}
        <table className="mt-4 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#1d3a6e] text-white">
              <th className="border border-[#1d3a6e] px-2 py-1.5 text-left">Sr.</th>
              <th className="border border-[#1d3a6e] px-2 py-1.5 text-left">Description</th>
              <th className="border border-[#1d3a6e] px-2 py-1.5 text-left">Model</th>
              <th className="border border-[#1d3a6e] px-2 py-1.5 text-center">Qty</th>
              <th className="border border-[#1d3a6e] px-2 py-1.5 text-right">Unit Price (Rs)</th>
              <th className="border border-[#1d3a6e] px-2 py-1.5 text-right">Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="border border-neutral-400 px-2 py-2">1</td>
              <td className="border border-neutral-400 px-2 py-2">
                <p className="font-semibold">{DEMO_ITEM}</p>
                <p className="text-[11px] text-neutral-600">
                  Sewing area 220 × 100 mm, direct-drive servo, with table &amp; stand. Brand new, Japan.
                </p>
              </td>
              <td className="border border-neutral-400 px-2 py-2 font-semibold">{DEMO_MODEL}</td>
              <td className="border border-neutral-400 px-2 py-2 text-center">{item.qty}</td>
              <td className="border border-neutral-400 px-2 py-2 text-right">{groupPKR(item.unitPrice)}</td>
              <td className="border border-neutral-400 px-2 py-2 text-right">{groupPKR(item.lineTotal!)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="border border-neutral-400 px-2 py-2 text-right font-bold uppercase">
                Total
              </td>
              <td className="border border-neutral-400 px-2 py-2 text-right font-bold">
                Rs {groupPKR(q.printedTotal!)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[12px] italic">Amount in words: Rupees Sixty Lakh Only.</p>

        {/* Terms */}
        <section className="mt-6">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#1d3a6e]">Terms &amp; Conditions</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <span className="font-semibold">{q.cashDiscountPct}% discount for full cash payment</span> at the time of
              order.
            </li>
            <li>
              <span className="rounded bg-yellow-200 px-1 font-bold">
                Easy installments: {q.installmentMonths} monthly installments of Rs {groupPKR(q.installmentAmount!)} —{" "}
                {q.markupClaimedPct}% markup!
              </span>
            </li>
            <li>First installment due one month after delivery.</li>
            <li>Prices inclusive of delivery and installation within Faisalabad.</li>
            <li>Warranty: one year on parts against manufacturing defects.</li>
            <li>This quotation is valid for {q.validityDays} days from the date above.</li>
          </ol>
        </section>

        <section className="mt-5 text-[12px] text-neutral-700">
          <p className="font-semibold text-neutral-900">Bank details</p>
          <p>Meezan Bank Ltd, Kotwali Road Branch, Faisalabad</p>
          <p>Title: Al-Noor Industrial Machines · IBAN: PK36 MEZN 0002 3101 0456 7890</p>
        </section>

        <p className="mt-5">We hope our offer meets your requirements and look forward to your valued order.</p>

        {/* Signature + stamp */}
        <section className="relative mt-8 flex items-end justify-between">
          <div className="relative w-64">
            <p>For Al-Noor Industrial Machines</p>
            <svg viewBox="0 0 240 70" className="mt-1 h-16 w-60" aria-hidden>
              <path
                d="M8 48 C 20 10, 34 10, 30 44 S 52 60, 60 30 S 74 8, 78 40 C 82 58, 96 50, 104 34 C 110 24, 118 30, 116 42 C 114 52, 128 50, 138 36 C 146 26, 152 40, 160 38 C 176 34, 190 22, 232 28"
                fill="none"
                stroke="#1a2a8a"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M40 58 C 90 52, 150 56, 210 50" fill="none" stroke="#1a2a8a" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <div className="border-t border-neutral-500 pt-1">
              <p className="font-semibold">M. Imran Qureshi</p>
              <p className="text-[12px] text-neutral-600">Sales Manager · Authorised Signatory</p>
            </div>
          </div>

          <svg
            viewBox="0 0 200 200"
            className="absolute bottom-0 left-56 h-40 w-40 -rotate-12 opacity-80 mix-blend-multiply"
            aria-hidden
          >
            <defs>
              <path id="stampTop" d="M 100,100 m -72,0 a 72,72 0 1,1 144,0" />
              <path id="stampBottom" d="M 100,100 m -72,0 a 72,72 0 1,0 144,0" />
            </defs>
            <circle cx="100" cy="100" r="94" fill="none" stroke="#6b2fa0" strokeWidth="4" />
            <circle cx="100" cy="100" r="86" fill="none" stroke="#6b2fa0" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="50" fill="none" stroke="#6b2fa0" strokeWidth="1.5" />
            <text fill="#6b2fa0" fontSize="15" fontWeight="700" letterSpacing="2" fontFamily="Arial, sans-serif">
              <textPath href="#stampTop" startOffset="50%" textAnchor="middle">
                AL-NOOR INDUSTRIAL MACHINES
              </textPath>
            </text>
            <text fill="#6b2fa0" fontSize="14" fontWeight="700" letterSpacing="3" fontFamily="Arial, sans-serif">
              <textPath href="#stampBottom" startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
                ★ FAISALABAD ★
              </textPath>
            </text>
            <text x="100" y="96" fill="#6b2fa0" fontSize="16" fontWeight="800" textAnchor="middle" fontFamily="Arial, sans-serif">
              SALES
            </text>
            <text x="100" y="116" fill="#6b2fa0" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="Arial, sans-serif">
              08 OCT 2026
            </text>
          </svg>

          <div className="text-right text-[11px] text-neutral-500">
            <p>E. &amp; O.E.</p>
          </div>
        </section>

        <footer className="mt-auto border-t border-neutral-300 pt-2 text-center text-[10.5px] text-neutral-500">
          Authorised dealers for industrial sewing equipment · Faisalabad · Lahore · Sialkot
        </footer>
      </article>
    </main>
  );
}
