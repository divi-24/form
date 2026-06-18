const form = document.querySelector("#registrationForm");
const membersContainer = document.querySelector("#members");
const memberLinkedinPosts = document.querySelector("#memberLinkedinPosts");
const memberSummary = document.querySelector("#memberSummary");
const slotOptions = document.querySelector("#slotOptions");
const progressStep = document.querySelector("#progressStep");
const formError = document.querySelector("#formError");
const successModal = document.querySelector("#successModal");
const submitButton = document.querySelector("#submitButton");
const submitLabel = submitButton.querySelector(".submit-label");
const successTeamName = document.querySelector("#successTeamName");
const linkedinDraftPreview = document.querySelector("#linkedinDraftPreview");
const copyLinkedinDraft = document.querySelector("#copyLinkedinDraft");

const savedMembers = new Map();
let generatedLinkedinPost = "";
let isSubmitting = false;
let submitStartedAt = 0;
let submitTimer = null;
let slotAvailabilityLoaded = false;
let hasAvailableSlots = false;

function getVisibleMembers() {
  return [...document.querySelectorAll(".member-card")].map((card, index) => ({
    role: index === 0 ? "Team Lead" : `Member ${index + 1}`,
    name: card.querySelector(".name-input").value.trim(),
  }));
}

function formatMemberLine(members) {
  return members
    .map((member, index) => {
      const fallbackName = index === 0 ? "[Team Lead]" : `[Member ${index + 1}]`;
      return `• ${member.name || fallbackName}`;
    })
    .join("\n");
}

function createLinkedinPost(teamName, projectName) {
  const safeTeamName = teamName.trim() || "[Team Name]";
  const safeProjectName = projectName.trim() || "[Project Name]";
  const members = formatMemberLine(getVisibleMembers());

  return `From 1,500+ registrations and 700+ teams to the Hackfluence 2026 Mentorship Round.

And today, we're excited to share that Team ${safeTeamName} is one of the teams moving forward.

Being selected from a pool of talented builders, creators, marketers, designers, and innovators is both humbling and motivating. ❤️

Over the coming days, we'll be refining our vision, validating assumptions, gathering feedback from mentors, and transforming ${safeProjectName} into something that can create real impact.

A huge shoutout to Dropp and CodeBenders for creating a platform where ideas are not only welcomed but actively nurtured. Initiatives like Hackfluence remind us that innovation grows fastest when ambitious people are given the opportunity to build.

👥 Our Team:
${members}

To everyone who supported us, challenged our ideas, reviewed our PPTs, and believed in our vision, thank you. 🙌

The mentorship round is not the finish line.

It's Day One.

Let's build something worth remembering. 🚀

Dropp: https://www.linkedin.com/company/ondropp/
CodeBenders: https://www.linkedin.com/in/codebenders-igdtuw/

#Hackfluence2026 #Dropp #CodeBenders #CreatorEconomy #Innovation #Hackathon #BuildInPublic #Startups #Founders #TechForCreators #FutureOfWork #StudentBuilders`;
}

function saveVisibleMembers() {
  document.querySelectorAll(".member-card").forEach((card) => {
    const index = Number(card.dataset.member);
    savedMembers.set(index, {
      name: card.querySelector(".name-input").value,
      email: card.querySelector(".email-input").value,
      linkedinPostUrl: document.querySelector(`#member${index}LinkedinPostUrl`)?.value || "",
    });
  });
}

function createMemberCard(index, saved) {
  const isLeader = index === 1;
  const card = document.createElement("article");
  card.className = "member-card";
  card.dataset.member = index;

  card.innerHTML = `
    <div class="member-card-head">
      <span class="member-index">${String(index).padStart(2, "0")}</span>
      <div>
        <p class="member-role">${isLeader ? "Primary contact" : "Team member"}</p>
        <h3 class="member-title">${isLeader ? "Team leader" : `Member ${index}`}</h3>
      </div>
      <span class="required-note">Required</span>
    </div>
    <div class="field-grid">
      <div class="field">
        <label class="name-label" for="member${index}Name">${isLeader ? "Leader" : `Member ${index}`} name *</label>
        <input id="member${index}Name" class="name-input" name="member${index}Name" type="text" placeholder="Full name" required />
      </div>
      <div class="field">
        <label class="email-label" for="member${index}Email">${isLeader ? "Leader" : `Member ${index}`} email *</label>
        <input id="member${index}Email" class="email-input" name="member${index}Email" type="email" placeholder="name@example.com" required />
      </div>
    </div>
  `;

  card.querySelector(".name-input").value = saved.name || "";
  card.querySelector(".email-input").value = saved.email || "";

  return card;
}

function createLinkedinPostUrlCard(index, saved) {
  const isLeader = index === 1;
  const card = document.createElement("article");
  card.className = "proof-card";
  card.dataset.member = index;

  card.innerHTML = `
    <div class="proof-card-head">
      <span class="member-index proof-index">${String(index).padStart(2, "0")}</span>
      <div>
        <p class="member-role proof-role">${isLeader ? "Team leader post" : "Team member post"}</p>
        <h3 class="proof-title">${isLeader ? "Team leader" : `Member ${index}`}</h3>
      </div>
      <span class="required-note">Required</span>
    </div>
    <div class="field">
      <label for="member${index}LinkedinPostUrl">${isLeader ? "Leader" : `Member ${index}`} LinkedIn post URL *</label>
      <input id="member${index}LinkedinPostUrl" class="linkedin-post-url-input" name="member${index}LinkedinPostUrl" type="url" inputmode="url" placeholder="https://www.linkedin.com/posts/..." required />
    </div>
  `;

  card.querySelector(".linkedin-post-url-input").value = saved.linkedinPostUrl || "";

  return card;
}

function renderMembers(size) {
  saveVisibleMembers();
  membersContainer.innerHTML = "";
  memberLinkedinPosts.innerHTML = "";

  for (let index = 1; index <= size; index += 1) {
    const saved = savedMembers.get(index) || {};
    membersContainer.appendChild(createMemberCard(index, saved));
    memberLinkedinPosts.appendChild(createLinkedinPostUrlCard(index, saved));
  }

  memberSummary.textContent = `Showing fields for ${size} team members. Each member must submit their LinkedIn post URL.`;
  updateLinkedinDraft();
  updateSubmitState();
}

document.querySelectorAll('input[name="teamSize"]').forEach((radio) => {
  radio.addEventListener("change", (event) => renderMembers(Number(event.target.value)));
});

function renderSlotOptions(slots) {
  slotAvailabilityLoaded = true;
  hasAvailableSlots = slots.some((slot) => !slot.full);
  slotOptions.innerHTML = "";

  slots.forEach((slot) => {
    const percentFull = Math.min(100, Math.round((slot.taken / slot.capacity) * 100));
    const label = document.createElement("label");
    label.className = `slot-option${slot.full ? " is-full" : ""}`;
    label.innerHTML = `
      <input type="radio" name="mentorSlot" value="${slot.id}" ${slot.full ? "disabled" : ""} required />
      <span class="slot-radio" aria-hidden="true"></span>
      <span class="slot-content">
        <span class="slot-title">${slot.label}</span>
        <span class="slot-time">${slot.time}</span>
        <span class="slot-meta">${slot.remaining} of ${slot.capacity} slots left</span>
        <span class="slot-progress" aria-hidden="true"><span style="width: ${percentFull}%"></span></span>
      </span>
    `;
    slotOptions.appendChild(label);
  });

  if (!hasAvailableSlots) {
    slotOptions.insertAdjacentHTML("beforeend", `<p class="form-error slot-load-error">All mentorship slots are currently full.</p>`);
  }

  updateSubmitState();
}

async function loadSlotAvailability() {
  try {
    const response = await fetch("/api/registrations", { headers: { Accept: "application/json" } });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Could not load slot availability.");

    renderSlotOptions(result.slots);
  } catch (error) {
    slotAvailabilityLoaded = false;
    hasAvailableSlots = false;
    slotOptions.innerHTML = `<p class="form-error slot-load-error">${error.message}</p>`;
    updateSubmitState();
  }
}

document.querySelectorAll(".form-section").forEach((section, index) => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) progressStep.textContent = String(index + 1).padStart(2, "0");
    },
    { rootMargin: "-35% 0px -55%" },
  );
  observer.observe(section);
});

function validateLinkedinPostUrl(input) {
  input.setCustomValidity("");

  if (!input.value.trim()) {
    input.setCustomValidity("Paste your public LinkedIn post URL.");
    return;
  }

  try {
    const url = new URL(input.value.trim());
    const hostname = url.hostname.toLowerCase();
    const isLinkedinHost = hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");

    if (url.protocol !== "https:" || !isLinkedinHost) {
      input.setCustomValidity("Paste a valid LinkedIn URL.");
    }
  } catch {
    input.setCustomValidity("Paste a valid LinkedIn URL.");
  }
}

function validateFilledFields() {
  form.querySelectorAll('input[required][type="text"], input[required][type="email"]').forEach((input) => {
    input.setCustomValidity("");

    if (!input.value.trim()) {
      input.setCustomValidity("This field is required.");
    }
  });

  document.querySelectorAll(".linkedin-post-url-input").forEach(validateLinkedinPostUrl);

  const selectedSlot = form.querySelector('input[name="mentorSlot"]:checked');
  const slotInputs = [...form.querySelectorAll('input[name="mentorSlot"]')];
  slotInputs.forEach((input) => input.setCustomValidity(""));

  if (slotAvailabilityLoaded && hasAvailableSlots && !selectedSlot) {
    slotInputs.find((input) => !input.disabled)?.setCustomValidity("Choose an available mentorship slot.");
  }
}

function updateLinkedinDraft() {
  generatedLinkedinPost = createLinkedinPost(form.elements.teamName.value, form.elements.projectName.value);
  linkedinDraftPreview.textContent = generatedLinkedinPost;
}

function updateSubmitState() {
  if (isSubmitting) {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - submitStartedAt) / 1000));
    submitButton.disabled = true;
    submitLabel.textContent = `Saving registration... ${elapsedSeconds}s`;
    return;
  }

  validateFilledFields();
  formError.textContent = "";
  const ready = slotAvailabilityLoaded && hasAvailableSlots && form.checkValidity();
  submitButton.disabled = !ready;
  submitLabel.textContent = ready ? "Submit team" : "Complete all fields";
}

function startSubmitTimer() {
  isSubmitting = true;
  submitStartedAt = Date.now();
  updateSubmitState();
  submitTimer = window.setInterval(updateSubmitState, 1000);
}

function stopSubmitTimer() {
  isSubmitting = false;
  window.clearInterval(submitTimer);
  submitTimer = null;
}

form.addEventListener("input", updateSubmitState);
form.addEventListener("input", updateLinkedinDraft);
form.addEventListener("change", updateSubmitState);
form.addEventListener("change", updateLinkedinDraft);

copyLinkedinDraft.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generatedLinkedinPost);
    copyLinkedinDraft.textContent = "Copied";
    window.setTimeout(() => {
      copyLinkedinDraft.textContent = "Copy post content";
    }, 1400);
  } catch {
    copyLinkedinDraft.textContent = "Select and copy the text above";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  validateFilledFields();

  if (!slotAvailabilityLoaded || !hasAvailableSlots || !form.checkValidity()) {
    const invalidField = form.querySelector(":invalid");
    formError.textContent = invalidField?.validationMessage || "Almost there. Please complete every required field and choose an available slot.";
    invalidField?.focus();
    updateSubmitState();
    return;
  }

  startSubmitTimer();

  try {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Could not save the registration.");

    const teamName = form.elements.teamName.value.trim();
    successTeamName.textContent = teamName;
    successModal.hidden = false;
    document.body.classList.add("modal-open");
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    stopSubmitTimer();
    updateSubmitState();
  }
});

renderMembers(2);
loadSlotAvailability();
