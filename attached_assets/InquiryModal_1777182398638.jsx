import { useState } from 'react';
import { Mail, X, Shield } from 'lucide-react';

export default function InquiryModal({ isOpen = true, onClose = () => {}, onSubmit }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    description: '',
    source: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (onSubmit) {
      await onSubmit(formData);
    } else {
      console.log('Inquiry submitted:', formData);
    }
    onClose();
  };

  if (!isOpen) return null;

  const steps = [
    {
      num: '1',
      title: 'We get in touch',
      body: "Jules will personally reply within 24 hours to confirm we've received your inquiry.",
    },
    {
      num: '2',
      title: 'On-site assessment',
      body: 'We book a time to visit your property, assess the trees, and discuss what you need done.',
    },
    {
      num: '3',
      title: 'Detailed quote',
      body: "You'll receive a clear quote with no hidden costs — usually within 48 hours.",
    },
    {
      num: '4',
      title: 'Schedule the work',
      body: 'Once approved, our qualified arborists schedule the job at a time that suits you.',
    },
    {
      num: '✓',
      title: 'Job done, site cleaned',
      body: 'We complete the work safely, tidy up, and leave your property looking better than we found it.',
      complete: true,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl md:grid-cols-[360px_1fr]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT: FORM */}
        <div className="flex flex-col border-r border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ backgroundColor: '#39FF14' }}
              >
                <Mail className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-medium text-gray-900">New inquiry</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <div className="flex flex-col gap-2.5 p-4">
              {/* First + Last */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    First name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Mel"
                    required
                    className="h-8 w-full rounded-md border border-gray-300 px-2.5 text-[13px] focus:border-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Last name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="McIntyre"
                    required
                    className="h-8 w-full rounded-md border border-gray-300 px-2.5 text-[13px] focus:border-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@email.com"
                  required
                  className="h-8 w-full rounded-md border border-gray-300 px-2.5 text-[13px] focus:border-gray-900 focus:outline-none"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="021 234 5678"
                  required
                  className="h-8 w-full rounded-md border border-gray-300 px-2.5 text-[13px] focus:border-gray-900 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Inquiry description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Tell us about the job..."
                  rows={3}
                  required
                  className="w-full resize-y rounded-md border border-gray-300 px-2.5 py-2 text-[13px] focus:border-gray-900 focus:outline-none"
                />
              </div>

              {/* Source */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  How did you find us?
                </label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  required
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-[13px] focus:border-gray-900 focus:outline-none"
                >
                  <option value="">Select...</option>
                  <option>Google search</option>
                  <option>Google Ads</option>
                  <option>Facebook</option>
                  <option>Referral</option>
                  <option>Repeat customer</option>
                  <option>Drove past truck</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-[13px] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-black px-3.5 py-1.5 text-[13px] font-medium hover:opacity-90"
                style={{ color: '#39FF14' }}
              >
                Send inquiry
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: ARTICLE */}
        <div className="hidden flex-col bg-gray-50 p-5 md:flex">
          <div className="mb-1.5 text-[11px] font-medium tracking-wider text-green-600">
            WHAT HAPPENS NEXT
          </div>
          <h2 className="mb-3.5 text-[17px] font-medium leading-tight text-gray-900">
            From inquiry to job done
          </h2>

          <div className="flex flex-1 flex-col gap-3.5">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2.5">
                <div
                  className="flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                  style={{
                    width: '22px',
                    height: '22px',
                    backgroundColor: step.complete ? '#000' : '#39FF14',
                    color: step.complete ? '#39FF14' : '#000',
                  }}
                >
                  {step.num}
                </div>
                <div>
                  <div className="mb-0.5 text-[13px] font-medium text-gray-900">
                    {step.title}
                  </div>
                  <div className="text-[12px] leading-relaxed text-gray-600">
                    {step.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust footer */}
          <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3 text-[11px] text-gray-600">
            <Shield className="h-3.5 w-3.5 text-green-600" />
            Fully insured · Qualified arborists · Gisborne local
          </div>
        </div>
      </div>
    </div>
  );
}
