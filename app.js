const form = document.querySelector("#registrationForm");
const membersContainer = document.querySelector("#members");
const memberProofs = document.querySelector("#memberProofs");
const memberSummary = document.querySelector("#memberSummary");
const progressStep = document.querySelector("#progressStep");
const formError = document.querySelector("#formError");
const successModal = document.querySelector("#successModal");
const submitButton = document.querySelector("#submitButton");
const submitLabel = submitButton.querySelector(".submit-label");
const successTeamName = document.querySelector("#successTeamName");
const linkedinDraft = document.querySelector("#linkedinDraft");

const savedMembers = new Map();
const droppUsernamePattern = /^[a-z0-9][a-z0-9_-]*$/i;
let generatedLinkedinPost = "";
let isSubmitting = false;
let submitStartedAt = 0;
let submitTimer = null;

function createLinkedinPost(teamName) {
  return `We're officially in for Hackfluence 2026!

Team ${teamName} is ready to build, experiment, and turn bold ideas into real influence.

Excited to take on the challenge with Dropp and connect with an incredible community of builders.

Follow Dropp on LinkedIn: https://www.linkedin.com/company/ondropp/

#Hackfluence2026 #Dropp #Hackathon #Builders #CreatorEconomy`;
}

function saveVisibleMembers() {
  document.querySelectorAll(".member-card").forEach((card) => {
    const index = Number(card.dataset.member);
    const profileUrlInput = document.querySelector(`#member${index}DroppProfileUrl`);
    savedMembers.set(index, {
      name: card.querySelector(".name-input").value,
      email: card.querySelector(".email-input").value,
      droppProfileUrl: profileUrlInput?.value || "",
    });
  });
}

function getDroppUsername(value) {
  try {
    const url = new URL(value.trim());
    const [, profileSegment, username] = url.pathname.replace(/\/+$/, "").split("/");
    const isDroppHost = ["ondropp.app", "www.ondropp.app"].includes(url.hostname.toLowerCase());

    if (url.protocol !== "https:" || !isDroppHost || profileSegment !== "profile" || !droppUsernamePattern.test(username)) {
      return "";
    }

    return username.toLowerCase();
  } catch {
    return "";
  }
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

function createProofCard(index, saved) {
  const isLeader = index === 1;
  const proofCard = document.createElement("article");
  proofCard.className = "proof-card";
  proofCard.dataset.member = index;

  proofCard.innerHTML = `
    <div class="proof-card-head">
      <span class="member-index proof-index">${String(index).padStart(2, "0")}</span>
      <div>
        <p class="member-role proof-role">${isLeader ? "Team leader proof" : "Team member proof"}</p>
        <h3 class="proof-title">${isLeader ? "Team leader" : `Member ${index}`}</h3>
      </div>
      <span class="required-note">Profile URL + checkpoint</span>
    </div>
    <div class="field">
      <label class="profile-url-label" for="member${index}DroppProfileUrl">${isLeader ? "Leader" : `Member ${index}`} Dropp profile URL *</label>
      <input id="member${index}DroppProfileUrl" class="profile-url-input" name="member${index}DroppProfileUrl" type="url" inputmode="url" placeholder="Paste your Dropp profile URL" title="Use your own Dropp profile URL from your profile page." required />
    </div>
    <label class="confirm-check member-check">
      <input class="proof-check" name="member${index}DroppConfirmation" type="checkbox" required />
      <span class="proof-check-label">${isLeader ? "The team leader" : `Member ${index}`} confirms this is their own Dropp profile and they followed all social handles.</span>
    </label>
  `;

  proofCard.querySelector(".profile-url-input").value = saved.droppProfileUrl || "";

  return proofCard;
}

function renderMembers(size) {
  saveVisibleMembers();
  membersContainer.innerHTML = "";
  memberProofs.innerHTML = "";

  for (let index = 1; index <= size; index += 1) {
    const saved = savedMembers.get(index) || {};
    membersContainer.appendChild(createMemberCard(index, saved));
    memberProofs.appendChild(createProofCard(index, saved));
  }

  memberSummary.textContent = `Showing fields for ${size} team members.`;
  updateSubmitState();
}

document.querySelectorAll('input[name="teamSize"]').forEach((radio) => {
  radio.addEventListener("change", (event) => renderMembers(Number(event.target.value)));
});

document.querySelectorAll(".form-section").forEach((section, index) => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) progressStep.textContent = String(index + 1).padStart(2, "0");
    },
    { rootMargin: "-35% 0px -55%" },
  );
  observer.observe(section);
});

function validateUniqueDroppUsernames() {
  const seenUsernames = new Map();

  document.querySelectorAll(".profile-url-input").forEach((input) => {
    input.setCustomValidity("");

    const username = getDroppUsername(input.value);
    if (input.value.trim() && !username) {
      input.setCustomValidity("Use your own Dropp profile URL from your profile page.");
      return;
    }

    if (!username) return;

    const firstInput = seenUsernames.get(username);
    if (firstInput) {
      input.setCustomValidity("Each team member must use a unique Dropp username.");
      firstInput.setCustomValidity("Each team member must use a unique Dropp username.");
      return;
    }

    seenUsernames.set(username, input);
  });
}

function updateSubmitState() {
  if (isSubmitting) {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - submitStartedAt) / 1000));
    submitButton.disabled = true;
    submitLabel.textContent = `Saving registration... ${elapsedSeconds}s`;
    return;
  }

  validateUniqueDroppUsernames();
  const ready = form.checkValidity();
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
form.addEventListener("change", updateSubmitState);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  validateUniqueDroppUsernames();

  if (!form.checkValidity()) {
    const invalidField = form.querySelector(":invalid");
    formError.textContent = invalidField?.validationMessage || "Almost there. Please complete every required field.";
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
    generatedLinkedinPost = createLinkedinPost(teamName);
    successTeamName.textContent = teamName;
    linkedinDraft.textContent = generatedLinkedinPost;
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
