const form = document.querySelector("#registrationForm");
const membersContainer = document.querySelector("#members");
const memberTemplate = document.querySelector("#memberTemplate");
const proofTemplate = document.querySelector("#proofTemplate");
const memberProofs = document.querySelector("#memberProofs");
const memberSummary = document.querySelector("#memberSummary");
const progressStep = document.querySelector("#progressStep");
const formError = document.querySelector("#formError");
const successModal = document.querySelector("#successModal");
const resetButton = document.querySelector("#resetButton");
const submitButton = document.querySelector("#submitButton");
const submitLabel = submitButton.querySelector(".submit-label");
const successTeamName = document.querySelector("#successTeamName");
const linkedinDraft = document.querySelector("#linkedinDraft");
const linkedinShareButton = document.querySelector("#linkedinShareButton");
const copyPostButton = document.querySelector("#copyPostButton");
const shareStatus = document.querySelector("#shareStatus");

const savedMembers = new Map();
const proofFiles = new Map();
const processingProofs = new Set();
const maxScreenshotBytes = 850 * 1024;
let generatedLinkedinPost = "";

function createLinkedinPost(teamName) {
  return `We're officially in for Hackfluence 2026!

Team ${teamName} is ready to build, experiment, and turn bold ideas into real influence.

Excited to take on the challenge with Dropp and connect with an incredible community of builders.

Follow Dropp on LinkedIn: https://www.linkedin.com/company/ondropp/

#Hackfluence2026 #Dropp #Hackathon #Builders #CreatorEconomy`;
}

async function copyLinkedinPost() {
  await navigator.clipboard.writeText(generatedLinkedinPost);
  shareStatus.textContent = "Post copied. Paste it into LinkedIn and share!";
}

function saveVisibleMembers() {
  document.querySelectorAll(".member-card").forEach((card) => {
    const index = Number(card.dataset.member);
    savedMembers.set(index, {
      name: card.querySelector(".name-input").value,
      email: card.querySelector(".email-input").value,
    });
  });
}

function renderMembers(size) {
  saveVisibleMembers();
  membersContainer.innerHTML = "";
  memberProofs.innerHTML = "";
  proofFiles.clear();
  processingProofs.clear();

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

    const proofInput = proofCard.querySelector(".proof-input");
    proofInput.id = `member${index}Screenshot`;
    proofInput.name = `member${index}Screenshot`;

    const proofCheck = proofCard.querySelector(".proof-check");
    proofCheck.name = `member${index}DroppConfirmation`;
    proofCard.querySelector(".proof-check-label").textContent =
      `${isLeader ? "The team leader" : `Member ${index}`} confirms they logged in to Dropp and followed all social handles.`;

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

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function optimizeScreenshot(file) {
  if (file.size <= maxScreenshotBytes) return file;

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > maxScreenshotBytes && quality > 0.42) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  if (!blob || blob.size > maxScreenshotBytes) {
    throw new Error("This screenshot could not be optimized. Please upload a smaller image.");
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

memberProofs.addEventListener("change", async (event) => {
  if (!event.target.matches(".proof-input")) return;

  const fileInput = event.target;
  const file = fileInput.files[0];
  const proofCard = fileInput.closest(".proof-card");
  const memberIndex = Number(proofCard.dataset.member);
  const uploadPreview = proofCard.querySelector(".proof-preview");
  const uploadTitle = proofCard.querySelector(".proof-upload-title");
  const uploadHelp = proofCard.querySelector(".proof-upload-help");
  formError.textContent = "";
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    fileInput.value = "";
    proofFiles.delete(memberIndex);
    formError.textContent = "That screenshot is over 8 MB. Please choose a smaller image.";
    updateSubmitState();
    return;
  }

  processingProofs.add(memberIndex);
  proofFiles.delete(memberIndex);
  uploadTitle.textContent = "Optimizing screenshot...";
  uploadHelp.textContent = "One moment";
  updateSubmitState();

  try {
    const optimizedFile = await optimizeScreenshot(file);
    proofFiles.set(memberIndex, optimizedFile);
    uploadPreview.src = URL.createObjectURL(optimizedFile);
    uploadPreview.hidden = false;
    uploadTitle.textContent = optimizedFile.name;
    uploadHelp.textContent = "Screenshot ready · Click to replace";
  } catch (error) {
    fileInput.value = "";
    formError.textContent = error.message;
    uploadTitle.textContent = "Drop this member's screenshot here";
    uploadHelp.textContent = "PNG, JPG or WEBP · Optimized automatically";
  } finally {
    processingProofs.delete(memberIndex);
    updateSubmitState();
  }
});

function updateSubmitState() {
  const teamSize = Number(form.elements.teamSize.value);
  const ready = form.checkValidity() && proofFiles.size === teamSize && processingProofs.size === 0;
  submitButton.disabled = !ready;
  submitLabel.textContent = processingProofs.size ? "Optimizing screenshots..." : ready ? "Submit team" : "Complete all fields";
}

form.addEventListener("input", updateSubmitState);
form.addEventListener("change", updateSubmitState);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";

  if (!form.checkValidity()) {
    formError.textContent = "Almost there. Please complete every required field.";
    form.querySelector(":invalid")?.focus();
    updateSubmitState();
    return;
  }

  submitButton.disabled = true;
  submitLabel.textContent = "Saving registration...";

  try {
    const formData = new FormData(form);
    for (let index = 1; index <= Number(form.elements.teamSize.value); index += 1) {
      formData.delete(`member${index}Screenshot`);
      formData.append(`member${index}Screenshot`, proofFiles.get(index));
    }

    const response = await fetch("/api/registrations", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Could not save the registration.");

    const teamName = form.elements.teamName.value.trim();
    generatedLinkedinPost = createLinkedinPost(teamName);
    successTeamName.textContent = teamName;
    linkedinDraft.textContent = generatedLinkedinPost;
    shareStatus.textContent = "";
    successModal.hidden = false;
    document.body.classList.add("modal-open");
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    updateSubmitState();
  }
});

linkedinShareButton.addEventListener("click", async () => {
  try {
    await copyLinkedinPost();
    const shareUrl = new URL("https://www.linkedin.com/sharing/share-offsite/");
    shareUrl.searchParams.set("url", window.location.href.split("#")[0]);
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  } catch {
    shareStatus.textContent = "Copy the draft above, then open LinkedIn to share it.";
  }
});

copyPostButton.addEventListener("click", async () => {
  try {
    await copyLinkedinPost();
  } catch {
    shareStatus.textContent = "Select and copy the draft above.";
  }
});

resetButton.addEventListener("click", () => {
  form.reset();
  savedMembers.clear();
  proofFiles.clear();
  processingProofs.clear();
  renderMembers(2);
  successModal.hidden = true;
  document.body.classList.remove("modal-open");
  shareStatus.textContent = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
  updateSubmitState();
});

renderMembers(2);
