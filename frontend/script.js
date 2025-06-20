// ✅ KONFIGURIMI I SOCKET.IO DHE FIREBASE
const socket = io();

// 🔥 Konfigurimi i Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC_o9iZguWFARZoFJvGNYYyten6rZ1-0eo",
  authDomain: "she4she-776f9.firebaseapp.com",
  databaseURL: "https://she4she-776f9-default-rtdb.firebaseio.com",
  projectId: "she4she-776f9",
  storageBucket: "she4she-776f9.firebasestorage.app",
  messagingSenderId: "929846208638",
  appId: "1:929846208638:web:1c8ee2c14aba0e6476d02f",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variablat globale të gjendjes
let currentVolunteer = null;
let currentRoom = null;
let currentUserType = null;
let chart = null; // Variabël globale për instancën Chart.js për statistika
const dataList = []; // Ruajtja e të gjitha kërkesave të ndihmës për statistika (filtruar për ato aktive)

// Instanca Mapbox
let map;
let markers = {};

// --- Tokeni i Qasjes Mapbox ---
mapboxgl.accessToken =
  "pk.eyJ1IjoiemVocmFiYWpyYW1paSIsImEiOiJjbWJ6djJlajAxcWs1MmxxdWF3dHN4bGhxIn0.Q7qyLj6wWjsJmjKIYiKqdg";
// Funksion ndihmës për shfaqjen e mesazheve globale
function showGlobalMessage(message, isError = false) {
  const globalMessage = document.getElementById("globalMessage");
  globalMessage.textContent = message;
  if (isError) {
    globalMessage.classList.add("error");
  } else {
    globalMessage.classList.remove("error");
  }
  globalMessage.classList.add("show");
  setTimeout(() => {
    globalMessage.classList.remove("show");
  }, 3000);
}

// --- Dëgjuesi i ngjarjeve DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("helpForm");
  const supportList = document.getElementById("supportList");
  // Elementet e Statistikave (tani merren direkt)
  const totalActiveReportsElement =
    document.getElementById("totalActiveReports");
  const mostFrequentFeelingsElement = document.getElementById(
    "mostFrequentFeelings"
  );
  const noStatsMessageElement = document.getElementById("noStatsMessage");
  const chartCanvas = document.getElementById("chartCanvas");
  const ctx = chartCanvas ? chartCanvas.getContext("2d") : null;

  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendChatBtn = document.getElementById("sendChatBtn");
  const chatHeader = document.getElementById("chatHeader"); // Kjo duhet të jetë ID-ja e h2-shit brenda modalit të bisedës

  const volunteersModal = document.getElementById("volunteersModal");
  const closeVolunteersBtn = document.getElementById("closeVolunteers");
  const chatModal = document.getElementById("chatModal");
  const closeChatBtn = document.getElementById("closeChat");
  const assignVolunteerModal = document.getElementById("assignVolunteerModal");
  const closeAssignVolunteerModalBtn = document.getElementById(
    "closeAssignVolunteerModal"
  );
  const assignVolunteerSelect = document.getElementById(
    "assignVolunteerSelect"
  );
  const confirmAssignBtn = document.getElementById("confirmAssignBtn");

  const volunteerRegistrationForm = document.getElementById(
    "volunteerRegistrationForm"
  );

  const navLinks = document.querySelectorAll(".nav-links a");
  const pageSections = document.querySelectorAll(".page-section"); // Sigurohu që të gjitha seksionet të kenë këtë klasë

  let currentRequestKeyForAssignment = null;

  // --- Inicializimi i Mapbox ---
  if (document.getElementById("map")) {
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: [20.47, 41.65],
      zoom: 6,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-left");
  } else {
    console.warn(
      "Elementi i hartës me ID 'map' nuk u gjet. Harta nuk do të inicializohet."
    );
  }

  // --- Kontrollo në ngarkim nëse ka një raport ID të ruajtur për përdoruesin anonim ---
  const storedAnonReportId = localStorage.getItem("currentAnonReportId");
  const storedAnonReportType = localStorage.getItem("currentAnonReportType");
  const storedAnonReportLocation = localStorage.getItem(
    "currentAnonReportLocation"
  );

  if (storedAnonReportId && storedAnonReportType && storedAnonReportLocation) {
    updateAnonymousChatUI(
      storedAnonReportId,
      storedAnonReportType,
      storedAnonReportLocation
    );
  }

  // --- Dëgjuesit e Ngjarjeve ---

  // Trajto dorëzimin e formularit të kërkesës së ndihmës
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.getElementById("type").value.trim();
    const location = document.getElementById("location").value.trim();
    const initialMessage = document
      .getElementById("initialMessage")
      .value.trim();

    if (!type || !location) {
      showGlobalMessage(
        "Ju lutemi plotësoni fushat 'Çfarë po ndjen?' dhe 'Vendndodhja'.",
        true
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        await saveNewReport({ type, location, initialMessage, coords });
      },
      async (error) => {
        console.warn("Nuk mund të merrja vendndodhjen:", error.message);
        await saveNewReport({ type, location, initialMessage, coords: null }); // Ruaj pa koordinata
      }
    );
  });

  async function saveNewReport({ type, location, initialMessage, coords }) {
    const reportId = db.ref("supports").push().key;
    const messagesArray = [];
    if (initialMessage) {
      messagesArray.push({
        sender: "Anonim",
        text: initialMessage,
        timestamp: new Date().toISOString(),
      });
    }

    const newReport = {
      id: reportId,
      location,
      type,
      coords: coords,
      timestamp: new Date().toISOString(),
      status: "pending",
      messages: messagesArray,
    };

    try {
      await db.ref(`supports/${reportId}`).set(newReport);
      // socket.emit('sendReport', newReport); // Kjo nuk është e nevojshme në këtë model
      showGlobalMessage("Ndjesia u raportua me sukses! Faleminderit.", false);
      form.reset();
      localStorage.setItem("currentAnonReportId", reportId);
      localStorage.setItem("currentAnonReportType", type);
      localStorage.setItem("currentAnonReportLocation", location);
      updateAnonymousChatUI(reportId, type, location);
    } catch (error) {
      console.error("Gabim gjatë raportimit të ndjesisë:", error);
      showGlobalMessage("Raportimi dështoi. Ju lutemi provoni sërish.", true);
    }
  }

  function updateAnonymousChatUI(reportId, type, location) {
    let anonChatContainer = document.getElementById("anonymousChatContainer");
    if (!anonChatContainer) {
      anonChatContainer = document.createElement("div");
      anonChatContainer.id = "anonymousChatContainer";
      document.querySelector(".column-left").appendChild(anonChatContainer);
    }

    anonChatContainer.innerHTML = `
        <div class="card mt-20">
            <h4>Biseda ime e fundit</h4>
            <p>Raporti i fundit: <strong id="anonReportType">${type}</strong> në <strong id="anonReportLocation">${location}</strong></p>
            <button class="btn primary" id="openAnonChatBtn">Rihap Bisedën</button>
        </div>
    `;

    document.getElementById("openAnonChatBtn").addEventListener("click", () => {
      db.ref(`supports/${reportId}`).once("value", (snapshot) => {
        const reportData = snapshot.val();
        if (reportData && reportData.status === "resolved") {
          showGlobalMessage(
            "Ky raport është zgjidhur dhe biseda nuk mund të rihapet.",
            true
          );
          localStorage.removeItem("currentAnonReportId");
          localStorage.removeItem("currentAnonReportType");
          localStorage.removeItem("currentAnonReportLocation");
          if (anonChatContainer) anonChatContainer.innerHTML = "";
        } else if (reportData) {
          openChatModal(reportId, type, location, "anonim");
        } else {
          showGlobalMessage("Raporti nuk u gjet ose nuk ekziston më.", true);
          localStorage.removeItem("currentAnonReportId");
          localStorage.removeItem("currentAnonReportType");
          localStorage.removeItem("currentAnonReportLocation");
          if (anonChatContainer) anonChatContainer.innerHTML = "";
        }
      });
    });
  }

  // --- Dëgjuesi kryesor i Firebase për të dhënat e mbështetjes ---
  db.ref("supports").on("value", (snapshot) => {
    supportList.innerHTML = "";
    for (const id in markers) {
      markers[id].remove();
    }
    markers = {};
    dataList.length = 0; // Pastro dataList

    let hasActiveSupports = false;

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        const key = childSnapshot.key;
        if (data.status !== "resolved") {
          dataList.push({ ...data, key: key });
          addSupportItemToList(data, key);
          addMarkerFromLocation(data.location, data.type, key);
          hasActiveSupports = true;
        }
      });
    }

    if (!hasActiveSupports) {
      showEmptySupportListMessage();
    } else {
      removeEmptySupportListMessage();
    }

    // Rëndësi: Thirr renderStats këtu gjithashtu, në rast se përdoruesi ndodhet tashmë në seksionin e statistikave
    // dhe të dhënat ndryshojnë.
    const statsPage = document.getElementById("statsPage");
    if (statsPage && statsPage.classList.contains("active")) {
      console.log(
        "Refreshing stats from Firebase listener. DataList size:",
        dataList.length
      ); // Debug
      renderStats(dataList);
    }
  });

  // --- Funksionet Ndihmëse për Menaxhimin e Listës së Ndihmës ---
  function createSupportListItem(data, key) {
    const li = document.createElement("li");
    li.className = "support-item";
    li.dataset.key = key;

    const content = document.createElement("div");
    content.className = "support-text";
    // Këtu shfaqej undefined - sigurohuni që 'type' dhe 'location' janë të mbushura në Firebase
    content.innerHTML = `💗 <strong>${
      data.type || "Ndjesi e panjohur"
    }</strong> në ${data.location || "Vendndodhje e panjohur"}`;
    li.appendChild(content);

    const controls = document.createElement("div");
    controls.className = "support-controls";

    const statusOrButton = document.createElement("div");

    if (!data.status || data.status === "pending") {
      const assignBtn = document.createElement("button");
      assignBtn.className = "assign-btn";
      assignBtn.textContent = "Merre përgjegjësinë";
      assignBtn.onclick = () => handleAssignToRequest(key, data);
      statusOrButton.appendChild(assignBtn);
    } else if (data.status === "ne_bisedim") {
      const span = document.createElement("span");
      span.className = "status-label";
      span.textContent = `🫂 në bisedë me ${data.volunteer || "Vullnetar"}`;
      statusOrButton.appendChild(span);

      const resolveBtn = document.createElement("button");
      resolveBtn.className = "assign-btn resolve-btn";
      resolveBtn.textContent = "Shëno si të zgjidhur";
      resolveBtn.onclick = () => handleResolveRequest(key);
      statusOrButton.appendChild(resolveBtn);
    } else if (data.status === "resolved") {
      const span = document.createElement("span");
      span.className = "status-label resolved";
      span.textContent = `✅ Zgjidhur nga ${data.volunteer || "anonim"}`;
      statusOrButton.appendChild(span);
    }
    controls.appendChild(statusOrButton);
    li.appendChild(controls);
    return li;
  }

  function addSupportItemToList(data, key) {
    if (
      data.status !== "resolved" &&
      !supportList.querySelector(`li[data-key="${key}"]`)
    ) {
      const listItem = createSupportListItem(data, key);
      supportList.prepend(listItem);
    }
    removeEmptySupportListMessage();
  }

  function showEmptySupportListMessage() {
    let msg = supportList.querySelector("#empty-list-message");
    if (!msg) {
      msg = document.createElement("p");
      msg.id = "empty-list-message";
      msg.textContent =
        "Nuk ka kërkesa aktive për ndihmë për momentin. Ju lutemi kontrolloni më vonë ose raportoni një ndjesi të re!";
      msg.style.cssText =
        "text-align: center; color: var(--light-text); margin-top: 30px; font-style: italic;";
      supportList.appendChild(msg);
    }
    msg.style.display = "block"; // Sigurohu që është i shfaqur
  }

  function removeEmptySupportListMessage() {
    const msg = supportList.querySelector("#empty-list-message");
    if (msg) msg.style.display = "none"; // Fshije vetem duke e fshehur
  }

  async function handleAssignToRequest(key, data) {
    currentRequestKeyForAssignment = key;
    assignVolunteerSelect.innerHTML =
      '<option value="">Zgjidh një vullnetar</option>';

    const storedVolunteerName = localStorage.getItem("volunteerName");
    if (storedVolunteerName) {
      const option = document.createElement("option");
      option.value = storedVolunteerName;
      option.textContent = storedVolunteerName;
      option.selected = true;
      assignVolunteerSelect.appendChild(option);
    } else {
      try {
        const snapshot = await db.ref("volunteer_registrations").once("value");
        const volunteers = snapshot.val();
        if (volunteers) {
          Object.keys(volunteers).forEach((volunteerKey) => {
            const volunteer = volunteers[volunteerKey];
            if (volunteer.name) {
              const option = document.createElement("option");
              option.value = volunteer.name;
              option.textContent = volunteer.name;
              assignVolunteerSelect.appendChild(option);
            }
          });
        } else {
          const option = document.createElement("option");
          option.value = "";
          option.textContent = "Nuk ka vullnetarë të regjistruar.";
          option.disabled = true;
          assignVolunteerSelect.appendChild(option);
        }
      } catch (error) {
        console.error("Gabim gjatë ngarkimit të vullnetarëve:", error);
        showGlobalMessage("Dështoi ngarkimi i listës së vullnetarëve.", true);
      }
    }
    assignVolunteerModal.classList.add("show-modal");
  }

  confirmAssignBtn.addEventListener("click", async () => {
    const selectedVolunteer = assignVolunteerSelect.value;
    if (!selectedVolunteer) {
      showGlobalMessage("Ju lutemi zgjidhni një vullnetar.", true);
      return;
    }
    if (!currentRequestKeyForAssignment) {
      showGlobalMessage(
        "Gabim: Asnjë kërkesë nuk është përzgjedhur për caktim.",
        true
      );
      return;
    }

    const dataSnapshot = await db
      .ref("supports/" + currentRequestKeyForAssignment)
      .once("value");
    const data = dataSnapshot.val();

    if (data.status === "ne_bisedim" && data.volunteer !== selectedVolunteer) {
      showGlobalMessage(
        `Ky rast është tashmë në bisedë me ${data.volunteer || "dikë tjetër"}.`,
        true
      );
      assignVolunteerModal.classList.remove("show-modal");
      currentRequestKeyForAssignment = null;
      return;
    }

    currentVolunteer = selectedVolunteer;
    currentRoom = currentRequestKeyForAssignment;
    currentUserType = "vullnetar";

    try {
      await db
        .ref("supports/" + currentRequestKeyForAssignment)
        .update({ status: "ne_bisedim", volunteer: selectedVolunteer });

      socket.emit("join_room", currentRequestKeyForAssignment);
      openChatModal(
        currentRequestKeyForAssignment,
        data.type,
        data.location,
        currentUserType
      );
      showGlobalMessage(
        `Jeni bashkuar në bisedë si ${currentVolunteer}!`,
        false
      );
      assignVolunteerModal.classList.remove("show-modal");
      currentRequestKeyForAssignment = null;
    } catch (error) {
      console.error("Gabim gjatë marrjes së përgjegjësisë:", error);
      showGlobalMessage(
        "Dështoi marrja e përgjegjësisë. Ju lutemi provoni sërish.",
        true
      );
    }
  });

  async function handleResolveRequest(key) {
    const confirmResolve = confirm(
      "Jeni të sigurt që dëshironi ta shënoni këtë kërkesë si të zgjidhur? Ky veprim është përfundimtar."
    );
    if (!confirmResolve) {
      return;
    }

    try {
      await db.ref("supports/" + key).update({ status: "resolved" });
      showGlobalMessage("Kërkesa u shënua si e zgjidhur!", false);
    } catch (error) {
      console.error("Gabim gjatë shënimit të kërkesës si të zgjidhur:", error);
      showGlobalMessage(
        "Dështoi shënimi si i zgjidhur. Ju lutemi provoni sërish.",
        true
      );
    }
  }

  // --- Funksionet Ndihmëse Mapbox ---
  function addMarkerFromLocation(location, type, key) {
    if (!map) {
      console.warn("Harta nuk është inicializuar. Nuk mund të shtoj shënjues.");
      return;
    }

    if (markers[key]) {
      markers[key].remove();
      delete markers[key];
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      location
    )}.json?access_token=${mapboxgl.accessToken}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Gabim HTTP! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.features && data.features.length > 0) {
          const coords = data.features[0].center;
          const popup = new mapboxgl.Popup({ offset: 25 }).setText(
            `${type} në ${location}`
          );
          const newMarker = new mapboxgl.Marker({ color: "#D81B60" })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map);
          markers[key] = newMarker;
        } else {
          console.warn(
            `Vendndodhja nuk u gjet për: ${location}. Shënjuesi nuk u shtua.`
          );
        }
      })
      .catch((err) =>
        console.error("Gabim në gjeokodimin ose API-n e Mapbox:", err)
      );
  }

  // --- Logjika e Statistikave ---

  function renderStats(data) {
    console.log("renderStats called with data length:", data.length); // Debug
    const activeData = data.filter((item) => item.status !== "resolved");
    console.log("Active data length after filter:", activeData.length); // Debug

    const stats = {};
    activeData.forEach((item) => {
      const type = item.type ? item.type.trim().toLowerCase() : "e panjohur"; // Sigurohu që type ekziston
      stats[type] = (stats[type] || 0) + 1;
    });

    // Përditësimi i elementeve ekzistuese në HTML
    if (totalActiveReportsElement) {
      totalActiveReportsElement.textContent = activeData.length;
    }

    if (activeData.length === 0) {
      if (noStatsMessageElement) noStatsMessageElement.style.display = "block";
      if (mostFrequentFeelingsElement)
        mostFrequentFeelingsElement.innerHTML = "";
      if (chart) {
        // Shkatërro instancën e grafikut nëse nuk ka të dhëna
        chart.destroy();
        chart = null;
      }
      return;
    } else {
      if (noStatsMessageElement) noStatsMessageElement.style.display = "none";
    }

    // Most Frequent Feelings List
    const sortedTypes = Object.entries(stats).sort(([, a], [, b]) => b - a);
    if (mostFrequentFeelingsElement) {
      mostFrequentFeelingsElement.innerHTML = "";
      sortedTypes.slice(0, 5).forEach(([type, count]) => {
        const listItem = document.createElement("li");
        listItem.textContent = `${
          type.charAt(0).toUpperCase() + type.slice(1)
        }: ${count} herë`;
        mostFrequentFeelingsElement.appendChild(listItem);
      });
    }

    // Chart.js rendering
    if (ctx && chartCanvas) {
      const labels = sortedTypes.map(
        ([type]) => type.charAt(0).toUpperCase() + type.slice(1)
      );
      const values = sortedTypes.map(([, count]) => count);
      const colors = [
        "#D81B60",
        "#8E24AA",
        "#FFD93D",
        "#6BCB77",
        "#4D96FF",
        "#FF9B54",
        "#78909C",
        "#C2185B",
        "#FBC02D",
        "#4CAF50",
        "#26A69A",
        "#BDBDBD",
        "#EF5350",
        "#AB47BC",
        "#FFEE58",
        "#A5D6A7",
        "#90CAF9",
        "#FFCC80",
      ];

      if (chart) {
        // Nëse instanca e grafikut ekziston, përditësoje
        chart.data.labels = labels;
        chart.data.datasets[0].data = values;
        chart.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
        chart.update();
      } else {
        // Nëse nuk ekziston, krijo një të ri
        chart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels,
            datasets: [
              {
                label: "Numri i Raporteve",
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom", // 🔁 NDËRRUAR nga 'right' në 'bottom'
                align: "center",
                labels: {
                  color: "#333",
                  font: {
                    size: 14,
                  },
                  boxWidth: 20,
                  padding: 10,
                },
              },
              tooltip: {
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                titleColor: "#D81B60",
                bodyColor: "#212121",
                borderColor: "#D81B60",
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: true,
                titleFont: { size: 16, weight: "bold" },
                bodyFont: { size: 14 },
                padding: 15,
                callbacks: {
                  label: function (context) {
                    let label = context.label || "";
                    if (label) {
                      label += ": ";
                    }
                    if (context.parsed !== null) {
                      const total = context.dataset.data.reduce(
                        (acc, val) => acc + val,
                        0
                      );
                      const percentage = (
                        (context.parsed / total) *
                        100
                      ).toFixed(1);
                      label += `${context.parsed} (${percentage}%)`;
                    }
                    return label;
                  },
                },
              },
              title: {
                display: true,
                text: "Shpërndarja e Ndjesive të Raportuara",
                font: {
                  size: 18,
                  weight: "bold",
                },
                color: "#333",
                padding: {
                  top: 20,
                  bottom: 20,
                },
              },
            },
          },
        });
      }
      console.log("Chart rendered/updated successfully."); // Debug
    } else {
      console.error(
        "Canvas element or its context not available for chart rendering."
      );
    }
  }

  // --- Logjika e Bisedës (Chat) ---
  function openChatModal(reportId, reportType, reportLocation, senderType) {
    chatModal.classList.add("show-modal");
    chatInput.focus();

    if (chatHeader) {
      chatHeader.textContent = `💬 Bisedë Mbështetëse për "${reportType}" në "${reportLocation}"`;
    }
    chatMessages.innerHTML = "";

    currentRoom = reportId;
    currentUserType = senderType;

    db.ref(`supports/${currentRoom}/messages`).off("child_added");

    db.ref(`supports/${currentRoom}/messages`)
      .orderByChild("timestamp")
      .on(
        "child_added",
        (childSnapshot) => {
          const msg = childSnapshot.val();
          appendChatMessage(msg.sender, msg.text, msg.timestamp);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        },
        (error) => {
          console.error(
            "Gabim gjatë ngarkimit të mesazheve të bisedës:",
            error
          );
          showGlobalMessage("Dështoi ngarkimi i mesazheve të bisedës.", true);
        }
      );

    sendChatBtn.onclick = () => {
      const messageText = chatInput.value.trim();
      if (messageText && currentRoom && currentUserType) {
        let senderName = currentUserType;
        if (currentUserType === "vullnetar") {
          senderName = localStorage.getItem("volunteerName") || "Vullnetar";
        } else if (currentUserType === "anonim") {
          senderName = "Anonim";
        }

        const newMessage = {
          sender: senderName,
          text: messageText,
          timestamp: new Date().toISOString(),
        };

        const newMsgRef = db.ref(`supports/${currentRoom}/messages`).push();
        newMsgRef.set(newMessage);

        // Dërgo mesazhin te serveri Socket.IO (për sinkronizim real-time)
        socket.emit("sendMessage", {
          // Emri i ngjarjes 'sendMessage' (i rregulluar)
          roomId: currentRoom,
          message: newMessage, // Dërgo objektin e plotë të mesazhit
        });

        chatInput.value = "";
      }
    };

    // Dëgjo ngjarjen 'receive_message' nga serveri Socket.IO
    socket.off("receive_message"); // Heq dëgjuesin e vjetër për të shmangur duplifikimet
    socket.on("receive_message", (msg) => {
      // Merr objektin e plotë të mesazhit
      // Mesazhi tashmë është ruajtur në Firebase, kështu që nuk ka nevojë ta shtojmë këtu.
      // Rregulli i Firebase '.on("child_added")' do të kapë mesazhin e ri dhe do ta shfaqë.
      // Kjo siguron që mesazhet të vijnë vetëm një herë dhe nga burimi i vërtetë (Firebase).
      console.log("Mesazh i marrë nga socket:", msg);
    });
  }

  function appendChatMessage(sender, message, timestamp) {
    const msgElement = document.createElement("div");
    msgElement.classList.add("chat-message");

    if (
      currentUserType === "vullnetar" &&
      sender === (localStorage.getItem("volunteerName") || "Vullnetar")
    ) {
      msgElement.classList.add("my-message");
    } else if (currentUserType === "anonim" && sender === "Anonim") {
      msgElement.classList.add("my-message");
    } else {
      msgElement.classList.add("other-message");
    }

    const senderSpan = document.createElement("span");
    senderSpan.classList.add("sender-name");
    senderSpan.textContent = sender + ":";
    msgElement.appendChild(senderSpan);

    const messageTextSpan = document.createElement("span");
    messageTextSpan.textContent = message;
    msgElement.appendChild(messageTextSpan);

    const timeSpan = document.createElement("span");
    timeSpan.classList.add("timestamp");
    const date = new Date(timestamp);
    timeSpan.textContent = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    msgElement.appendChild(timeSpan);

    chatMessages.appendChild(msgElement);
  }

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendChatBtn.click();
    }
  });

  // --- Kontrolli i Modalit ---
  function closeChatAndDetachListener() {
    if (currentRoom) {
      db.ref(`supports/${currentRoom}/messages`).off("child_added");
    }
    chatModal.classList.remove("show-modal");
    currentVolunteer = null;
    currentRoom = null;
    currentUserType = null;
    socket.off("receive_message"); // Sigurohu që të heqësh dëgjuesin e socket
  }

  closeChatBtn.addEventListener("click", closeChatAndDetachListener);

  closeVolunteersBtn.addEventListener("click", () => {
    volunteersModal.classList.remove("show-modal");
  });

  closeAssignVolunteerModalBtn.addEventListener("click", () => {
    assignVolunteerModal.classList.remove("show-modal");
    currentRequestKeyForAssignment = null;
  });

  window.addEventListener("click", (e) => {
    if (e.target === volunteersModal)
      volunteersModal.classList.remove("show-modal");
    if (e.target === chatModal) {
      closeChatAndDetachListener();
    }
    if (e.target === assignVolunteerModal) {
      assignVolunteerModal.classList.remove("show-modal");
      currentRequestKeyForAssignment = null;
    }
  });

  // --- Logjika e Navigimit ---
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = e.target.id; // 'homeLink', 'statsLink', 'volunteersLink'

      navLinks.forEach((l) => l.classList.remove("active"));
      pageSections.forEach((s) => {
        s.classList.remove("active");
        s.style.display = "none";
      });
      // Sigurohuni që modalët të fshihen kur ndryshon seksioni
      volunteersModal.classList.remove("show-modal");
      chatModal.classList.remove("show-modal");
      assignVolunteerModal.classList.remove("show-modal");

      if (targetId === "homeLink") {
        const mainPage = document.getElementById("mainPage");
        if (mainPage) {
          mainPage.style.display = "block";
          mainPage.classList.add("active");
          e.target.classList.add("active");
          if (map) {
            setTimeout(() => {
              map.resize();
            }, 300);
          } // <-- KJO është vendosur drejt, por...
        }
      } else if (targetId === "statsLink") {
        const statsPage = document.getElementById("statsPage");
        if (statsPage) {
          statsPage.style.display = "block";
          statsPage.classList.add("active");
          e.target.classList.add("active");
          // Thirr renderStats kur kalohet te seksioni i statistikave
          console.log(
            "Navigating to stats. Calling renderStats with dataList length:",
            dataList.length
          ); // Debug
          renderStats(dataList);
        }
      } else if (targetId === "volunteersLink") {
        volunteersModal.classList.add("show-modal"); // Ky është një modal, jo seksion page-section
        e.target.classList.add("active");
        renderVolunteersList();
      }
    });
  });

  // Kjo siguron që seksioni "Home" të shfaqet si parazgjedhur në fillim
  document.getElementById("homeLink").click();

  // --- Funksioni për Paraqitjen e Vullnetarëve ---
  function renderVolunteersList() {
    const volunteersListContainer = document.getElementById(
      "volunteersListContainer"
    ); // Kontrolloi këtë ID
    if (!volunteersListContainer) {
      console.error("Elementi 'volunteersListContainer' nuk u gjet.");
      return;
    }
    volunteersListContainer.innerHTML =
      "<p style='text-align: center; color: var(--light-text); font-style: italic;'>Duke ngarkuar vullnetarët...</p>";

    db.ref("volunteer_registrations").on(
      "value",
      (snapshot) => {
        volunteersListContainer.innerHTML = "";
        const volunteers = snapshot.val();
        if (volunteers) {
          const ul = document.createElement("ul");
          ul.className = "volunteers-list";
          Object.keys(volunteers).forEach((key) => {
            const volunteer = volunteers[key];
            const li = document.createElement("li");
            li.className = "volunteer-item";
            li.innerHTML = `
            <h3>${volunteer.name}</h3>
            <p>📧 ${volunteer.email || "Nuk ka email"}</p>
            ${
              volunteer.contactNumber
                ? `<p>📞 ${volunteer.contactNumber}</p>`
                : ""
            }
            ${
              volunteer.message
                ? `<p class="volunteer-bio">${volunteer.message}</p>`
                : ""
            }
            <button class="btn delete-btn" data-key="${key}">Fshi</button>
          `;
            ul.appendChild(li);
          });
          volunteersListContainer.appendChild(ul);

          // Shto dëgjues ngjarjesh për butonat "Fshi"
          volunteersListContainer
            .querySelectorAll(".delete-btn")
            .forEach((button) => {
              button.addEventListener("click", (e) => {
                const volunteerKeyToDelete = e.target.dataset.key;
                handleDeleteVolunteer(volunteerKeyToDelete);
              });
            });
        } else {
          volunteersListContainer.innerHTML =
            "<p style='text-align: center; color: var(--light-text); font-style: italic;'>Nuk ka vullnetarë të regjistruar ende. Behu i pari!</p>";
        }
      },
      (error) => {
        console.error("Gabim gjatë ngarkimit të vullnetarëve:", error);
        volunteersListContainer.innerHTML =
          "<p style='text-align: center; color: var(--error-red); font-style: italic;'>Dështoi ngarkimi i vullnetarëve.</p>";
      }
    );
  }

  // --- Dorëzimi i Formularit të Regjistrimit të Vullnetarëve ---
  if (volunteerRegistrationForm) {
    volunteerRegistrationForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("volunteerName").value.trim();
      const email = document.getElementById("volunteerEmail").value.trim();
      const message = document.getElementById("volunteerMessage").value.trim();
      const contactNumber = document
        .getElementById("volunteerContactNumber")
        .value.trim();

      if (!name || !email) {
        showGlobalMessage("Ju lutemi plotësoni emrin dhe email-in.", true);
        return;
      }

      const volunteerApplicationData = {
        name,
        email,
        message,
        contactNumber,
        timestamp: new Date().toISOString(),
        status: "active",
      };

      try {
        await db.ref("volunteer_registrations").push(volunteerApplicationData);
        localStorage.setItem("volunteerName", name);
        showGlobalMessage(
          "Kërkesa juaj u dërgua me sukses! Faleminderit për interesin tuaj për të ndihmuar!",
          false
        );
        volunteerRegistrationForm.reset();
      } catch (error) {
        console.error("Gabim gjatë regjistrimit të vullnetarit:", error);
        showGlobalMessage(
          "Dështoi regjistrimi i vullnetarit. Ju lutemi provoni sërish.",
          true
        );
      }
    });
  }

  async function handleDeleteVolunteer(key) {
    const confirmDelete = confirm(
      "Jeni të sigurt që dëshironi ta fshini këtë vullnetar?"
    );
    if (!confirmDelete) {
      return;
    }
    try {
      await db.ref(`volunteer_registrations/${key}`).remove();
      showGlobalMessage("Vullnetari u fshi me sukses!", false);
      // Rifresko listën pas fshirjes
      renderVolunteersList(); // Thirr direkt funksionin për të rifreskuar
    } catch (error) {
      console.error("Gabim gjatë fshirjes së vullnetarit:", error);
      showGlobalMessage("Dështoi fshirja e vullnetarit.", true);
    }
  }

  // --- Funksionet e Daljes (Logout) ---
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Pastro localStorage
      localStorage.removeItem("currentAnonReportId");
      localStorage.removeItem("currentAnonReportType");
      localStorage.removeItem("currentAnonReportLocation");
      localStorage.removeItem("volunteerName"); // Nqs ka vullnetar të ruajtur

      // Ktheni UI në gjendjen fillestare
      const anonChatContainer = document.getElementById(
        "anonymousChatContainer"
      );
      if (anonChatContainer) {
        anonChatContainer.innerHTML = "";
      }

      // Opsionale: Rifresko faqen për të siguruar pastrim të plotë të gjendjes
      window.location.reload();
      showGlobalMessage("Jeni shkyçur me sukses.", false);
    });
  }
}); // Fundi i DOMContentLoaded
