import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contactFromThread,
  emailAddressFromDiary,
  fillEmptyJobContact,
  fillEmptyJobContactFromSources,
  isUnnamedJobContact,
} from "./jobContactFill.ts";

const janetCustomer = {
  name: "Janet Calder",
  email: "janetcalderwatson@gmail.com",
  phone: "0272484222",
  mobile: "",
};

describe("fillEmptyJobContact — Job 4225 shape", () => {
  it("copies name and email onto a job that only has a phone, and leaves that phone alone", () => {
    const patch = fillEmptyJobContact(
      {
        jobContactFirstName: "",
        jobContactLastName: null,
        jobContactEmail: "",
        jobContactPhone: "",
        jobContactMobile: "0272484222",
      },
      janetCustomer,
    );
    assert.deepEqual(patch, {
      jobContactFirstName: "Janet",
      jobContactLastName: "Calder",
      jobContactEmail: "janetcalderwatson@gmail.com",
    });
  });

  it("does not overwrite a name or email that is already on the job", () => {
    const patch = fillEmptyJobContact(
      {
        jobContactFirstName: "Sam",
        jobContactLastName: "Frasier",
        jobContactEmail: "sam@example.com",
        jobContactMobile: "021000000",
      },
      janetCustomer,
    );
    assert.deepEqual(patch, {});
  });

  it("does not copy the placeholder name Unknown onto the job", () => {
    const patch = fillEmptyJobContact(
      { jobContactMobile: "0272484222" },
      { name: "Unknown", email: "janetcalderwatson@gmail.com" },
    );
    assert.equal(patch.jobContactFirstName, undefined);
    assert.equal(patch.jobContactEmail, "janetcalderwatson@gmail.com");
  });

  it("fills a missing email without replacing a name that is already set", () => {
    const patch = fillEmptyJobContact(
      {
        jobContactFirstName: "Sam",
        jobContactLastName: "",
        jobContactEmail: "",
        jobContactMobile: "021000000",
      },
      janetCustomer,
    );
    assert.deepEqual(patch, {
      jobContactEmail: "janetcalderwatson@gmail.com",
    });
  });

  it("prefers the first source and only uses the next source for fields still empty", () => {
    const patch = fillEmptyJobContactFromSources(
      { jobContactMobile: "0272484222" },
      [
        { name: "Janet Calder", email: "" },
        { email: "janetcalderwatson@gmail.com" },
      ],
    );
    assert.equal(patch.jobContactFirstName, "Janet");
    assert.equal(patch.jobContactLastName, "Calder");
    assert.equal(patch.jobContactEmail, "janetcalderwatson@gmail.com");
    assert.equal(patch.jobContactPhone, undefined);
  });
});

describe("fillEmptyJobContact — phone placement", () => {
  it("puts a single NZ mobile on the mobile column when the job has no phone at all", () => {
    const patch = fillEmptyJobContact(
      {},
      { name: "Janet Calder", phone: "0272484222" },
    );
    assert.equal(patch.jobContactMobile, "0272484222");
    assert.equal(patch.jobContactPhone, undefined);
  });

  it("keeps a landline and a different mobile in their own columns", () => {
    const patch = fillEmptyJobContact(
      {},
      { phone: "06 867 0000", mobile: "0272484222" },
    );
    assert.equal(patch.jobContactMobile, "0272484222");
    assert.equal(patch.jobContactPhone, "06 867 0000");
  });

  it("does not copy a number into the empty landline when mobile is already set", () => {
    const patch = fillEmptyJobContact(
      { jobContactMobile: "0272484222" },
      { phone: "0272484222", mobile: "0272484222" },
    );
    assert.equal(patch.jobContactPhone, undefined);
    assert.equal(patch.jobContactMobile, undefined);
  });
});

describe("isUnnamedJobContact", () => {
  it("matches a phone-only job and ignores one that already has a name or email", () => {
    assert.equal(
      isUnnamedJobContact({ jobContactMobile: "0272484222", jobContactEmail: "", jobContactFirstName: "" }),
      true,
    );
    assert.equal(
      isUnnamedJobContact({ jobContactFirstName: "Janet", jobContactEmail: "" }),
      false,
    );
    assert.equal(
      isUnnamedJobContact({ jobContactEmail: "janetcalderwatson@gmail.com" }),
      false,
    );
  });
});

describe("diary and thread sources", () => {
  it("reads the address diary send stored on the email entry", () => {
    const email = emailAddressFromDiary([
      {
        entryType: "email",
        description: "Email sent to janetcalderwatson@gmail.com\n\nMessage:\nHi Janet,",
        metadata: { to: "janetcalderwatson@gmail.com", subject: "Mulch" },
      },
    ]);
    assert.equal(email, "janetcalderwatson@gmail.com");
  });

  it("falls back to the diary description when metadata has no address", () => {
    const email = emailAddressFromDiary([
      {
        entryType: "email",
        description: "Email sent to janetcalderwatson@gmail.com\n\nHi Janet,",
        metadata: {},
      },
    ]);
    assert.equal(email, "janetcalderwatson@gmail.com");
  });

  it("reads name and email out of a contact-form thread", () => {
    const source = contactFromThread([
      {
        fromContact: "janetcalderwatson@gmail.com",
        content: "Contact Form Submission\n\nName: Janet Calder\nEmail: janetcalderwatson@gmail.com\nPhone: 0272484222\n",
      },
    ]);
    assert.equal(source.name, "Janet Calder");
    assert.equal(source.email, "janetcalderwatson@gmail.com");
    assert.equal(source.phone, "0272484222");
  });

  it("uses the diary address when the customer has no email", () => {
    const patch = fillEmptyJobContactFromSources(
      { jobContactMobile: "0272484222" },
      [
        { name: "Janet Calder", email: "" },
        { email: emailAddressFromDiary([{ entryType: "email", metadata: { to: "janetcalderwatson@gmail.com" } }]) },
      ],
    );
    assert.equal(patch.jobContactEmail, "janetcalderwatson@gmail.com");
    assert.equal(patch.jobContactFirstName, "Janet");
  });
});
