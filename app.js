const form = document.querySelector("#registrationForm");
const membersContainer = document.querySelector("#members");
const memberTemplate = document.querySelector("#memberTemplate");
const proofTemplate = document.querySelector("#proofTemplate");
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

    if (url.protocol !== "https:" || !isDroppHost || profileSegment !== "profile" || !username) {
      return "";
    }

    return username.toLowerCase();
  } catch {
    return "";
  }
}

function renderMembers(size) {
  saveVisibleMembers();
  membersContainer.innerHTML = "";
  memberProofs.innerHTML = "";

  for (let index = 1; index <= size; index += 1) {
    const fragment = memberTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".member-card");
    const isLeader = index === 1;
    const saved = savedMembers.get(index) || {};

    card.dataset.member = index;
    card.querySelector(".member-index").textContent = String(index).padStart(2, "0");
    card.querySelector(".member-role").textContent = isLeader ? "Primary contact" : "Team member";
    card.querySelector(".member-title").textContent = isLeader ? "Team leader" : `Member ${index}`;

    const nameLabel = card.querySelector(".name-label");
    const nameInput = card.querySelector(".name-input");
    nameLabel.textContent = `${isLeader ? "Leader" : `Member ${index}`} name *`;
    nameLabel.htmlFor = `member${index}Name`;
    nameInput.id = `member${index}Name`;
    nameInput.name = `member${index}Name`;
    nameInput.value = saved.name || "";

    const emailLabel = card.querySelector(".email-label");
    const emailInput = card.querySelector(".email-input");
    emailLabel.textContent = `${isLeader ? "Leader" : `Member ${index}`} email *`;
    emailLabel.htmlFor = `member${index}Email`;
    emailInput.id = `member${index}Email`;
    emailInput.name = `member${index}Email`;
    emailInput.value = saved.email || "";

    membersContainer.appendChild(fragment);

    const proofFragment = proofTemplate.content.cloneNode(true);
    const proofCard = proofFragment.querySelector(".proof-card");
    proofCard.dataset.member = index;
    proofCard.querySelector(".proof-index").textContent = String(index).padStart(2, "0");
    proofCard.querySelector(".proof-role").textContent = isLeader ? "Team leader proof" : "Team member proof";
    proofCard.querySelector(".proof-title").textContent = isLeader ? "Team leader" : `Member ${index}`;

    const profileUrlLabel = proofCard.querySelector(".profile-url-label");
    const profileUrlInput = proofCard.querySelector(".profile-url-input");
    profileUrlLabel.textContent = `${isLeader ? "Leader" : `Member ${index}`} Dropp profile URL *`;
    profileUrlLabel.htmlFor = `member${index}DroppProfileUrl`;
    profileUrlInput.id = `member${index}DroppProfileUrl`;
    profileUrlInput.name = `member${index}DroppProfileUrl`;
    profileUrlInput.value = saved.droppProfileUrl || "";

    const proofCheck = proofCard.querySelector(".proof-check");
    proofCheck.name = `member${index}DroppConfirmation`;
    proofCard.querySelector(".proof-check-label").textContent =
      `${isLeader ? "The team leader" : `Member ${index}`} confirms this is their own Dropp profile and they followed all social handles.`;

    memberProofs.appendChild(proofFragment);
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
