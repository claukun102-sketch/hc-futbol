
  /* =====================================================
     SUPABASE
  ===================================================== */

  const SUPABASE_URL =
    "https://kyuwzcmrdylrhjrblcuw.supabase.co";

  /*
    PEGÁ ACÁ TU MISMA CLAVE PUBLISHABLE
    QUE YA ESTÁS USANDO EN EL CÓDIGO ACTUAL.
  */

  const SUPABASE_KEY =
    "sb_publishable_Skz1JtNhc11MsOLS-V_X-A_6GkBwFw0";

const client =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        storage: window.sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );


  /* =====================================================
     VARIABLES
  ===================================================== */

  let currentUser = null;
  let currentPlayer = null;
  let currentTeam = null;
  let myAdminTeams = [];


  /* =====================================================
     FORMATO DINERO
  ===================================================== */

  function money(value) {

    return new Intl.NumberFormat(
      "es-AR",
      {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
      }
    ).format(value || 0);

  }


  /* =====================================================
     FECHA
  ===================================================== */

  function formatDate(date) {

    if (!date) return "-";

    return new Date(date + "T00:00:00")
      .toLocaleDateString("es-AR");

  }


  /* =====================================================
     LOGIN
  ===================================================== */

  async function handleLogin() {

    const email =
      document.getElementById("email")
        .value
        .trim();

    const password =
      document.getElementById("password")
        .value;

    hideLoginError();

    if (!email || !password) {

      showLoginError(
        "Completá email y contraseña."
      );

      return;

    }

    const button =
      document.getElementById("loginButton");

    button.disabled = true;
    button.textContent = "Ingresando...";


    const {
      data,
      error
    } =
      await client.auth.signInWithPassword({
        email,
        password
      });


    button.disabled = false;
    button.textContent = "Ingresar";


    if (error) {

      showLoginError(
        error.message
      );

      return;

    }


    currentUser =
      data.user;

    await loadApplication();

  }

  window.handleLogin = handleLogin;

  async function handleRegister() {

    const email =
      document.getElementById("registerEmail")
        .value
        .trim();

    const password =
      document.getElementById("registerPassword")
        .value;

    const passwordConfirm =
      document.getElementById("registerPasswordConfirm")
        .value;

    hideRegisterMessages();

    if (!email || !password || !passwordConfirm) {
      showRegisterError(
        "Completá email, contraseña y confirmación de contraseña."
      );
      return;
    }

    if (password.length < 6) {
      showRegisterError(
        "La contraseña debe tener al menos 6 caracteres."
      );
      return;
    }

    if (password !== passwordConfirm) {
      showRegisterError(
        "Las contraseñas no coinciden."
      );
      return;
    }

    const button =
      document.getElementById("registerButton");

    button.disabled = true;
    button.textContent = "Creando cuenta...";

    const { data, error } =
      await client.auth.signUp({
        email,
        password
      });

    button.disabled = false;
    button.textContent = "Crear cuenta";

    if (error) {
      showRegisterError(
        error.message
      );
      return;
    }

    if (data.session) {
      currentUser = data.user;
      await loadApplication();
      return;
    }

    showRegisterSuccess(
      "Cuenta creada correctamente. Revisá tu email y confirmá tu cuenta antes de ingresar."
    );

    document.getElementById("registerPassword").value = "";
    document.getElementById("registerPasswordConfirm").value = "";

  }


  /* =====================================================
     CARGAR APLICACIÓN
  ===================================================== */

  async function loadApplication() {

    const {
      data: {
        user
      },
      error: userError
    } =
      await client.auth.getUser();


    if (
      userError ||
      !user
    ) {

      showLogin();

      return;

    }


    currentUser =
      user;


    const {
      data: account,
      error: accountError
    } =
      await client
        .from("player_accounts")
        .select(
          "role, player_id, team_id"
        )
        .eq(
          "auth_user_id",
          user.id
        )
        .single();

if (accountError || !account) {

  // Intentar aceptar automáticamente una invitación pendiente.
  const {
    data: invitationResult,
    error: invitationError
  } = await client.rpc(
    "accept_pending_team_invitation"
  );

  if (invitationError) {
    console.error(
      "Error aceptando invitación:",
      invitationError
    );
  }

  // Si se aceptó una invitación, volver a cargar
  // la aplicación para obtener el nuevo player_account.
  if (invitationResult?.accepted === true) {
    await loadApplication();
    return;
  }

  // Usuario autenticado pero todavía sin equipo.
  showOnboarding();

  return;

}
    
    if (
      account.role === "admin"
    ) {

      const {
        data: adminTeams,
        error: adminTeamsError
      } = await client.rpc("my_admin_teams");

      if (adminTeamsError) {
        showLoginError(
          "No pudimos cargar tus equipos: " +
          adminTeamsError.message
        );
        return;
      }

      myAdminTeams =
        (adminTeams || [])
          .map(normalizeTeam)
          .filter(team => team.active !== false);

      if (!myAdminTeams.length) {
        showLoginError(
          "Tu usuario no tiene ningún equipo administrable."
        );
        return;
      }

      currentTeam =
        myAdminTeams.find(
          team => team.id === account.team_id
        ) ||
        myAdminTeams[0];

      loginPage.classList.add("hidden");
      playerPage.classList.add("hidden");
      adminPage.classList.remove("hidden");

      renderCurrentTeam();
      await loadArchivedTeams();
      await loadAdminDashboard();

      return;

    }


    if (
      account.role === "player"
    ) {

      loginPage.classList.add("hidden");
      adminPage.classList.add("hidden");
      playerPage.classList.remove("hidden");

      await loadPlayerDashboard(
        account.player_id
      );

      return;

    }


    showLoginError(
      "Tu cuenta no tiene un rol válido."
    );

  }


  /* =====================================================
     MULTI-EQUIPO
  ===================================================== */

  function normalizeTeam(team) {

    return {
      id: team.id || team.team_id,
      name: team.name || team.team_name || "Mi equipo",
      description: team.description || "",
      sport: team.sport || "Fútbol",
      currency: team.currency || "ARS",
      country: team.country || "Argentina",
      active: team.active !== false
    };

  }


  function renderCurrentTeam() {

    if (!currentTeam) return;

    const title =
      document.getElementById("adminTeamName");

    if (title) {
      title.textContent =
        "⚽ " + currentTeam.name;
    }

    const container =
      document.getElementById("myTeams");

    if (!container) return;

    container.innerHTML = `
      <label>Equipo activo</label>

      <select
        onchange="selectAdminTeam(this.value)"
      >
        ${myAdminTeams.map(team => `
          <option
            value="${escapeHtml(team.id)}"
            ${team.id === currentTeam.id ? "selected" : ""}
          >
            ${escapeHtml(team.name)}
          </option>
        `).join("")}
      </select>

      <div class="payment">
        <strong>${escapeHtml(currentTeam.name)}</strong>
        <p class="muted">
          ${escapeHtml(currentTeam.description || "Equipo deportivo amateur")}
        </p>
        <p class="muted">
          ${escapeHtml(currentTeam.sport)}
          · ${escapeHtml(currentTeam.country)}
          · ${escapeHtml(currentTeam.currency)}
        </p>
      </div>
    `;

  }


  async function selectAdminTeam(teamId) {

    const selected =
      myAdminTeams.find(
        team => team.id === teamId
      );

    if (!selected) {
      showAdminError(
        "No tenés acceso a ese equipo."
      );
      return;
    }

    currentTeam = selected;

    renderCurrentTeam();
    await loadAdminDashboard();

  }


  function toggleOtherSportField() {

    const select = document.getElementById("newTeamSport");
    const other = document.getElementById("newTeamSportOther");

    if (!select || !other) return;

    const isOther = select.value === "Otro";
    other.style.display = isOther ? "block" : "none";

    if (!isOther) {
      other.value = "";
    }

  }


  async function createFirstTeam() {

    const name =
      document.getElementById("firstTeamName").value.trim();

    const description =
      document.getElementById("firstTeamDescription").value.trim();

    const sport =
      document.getElementById("firstTeamSport").value.trim();

    const currency =
      document.getElementById("firstTeamCurrency").value;

    const country =
      document.getElementById("firstTeamCountry").value.trim();

    const errorBox =
      document.getElementById("onboardingError");

    const button =
      document.getElementById("firstTeamButton");

    errorBox.classList.add("hidden");

    if (!name) {
      errorBox.textContent = "El nombre del equipo es obligatorio.";
      errorBox.classList.remove("hidden");
      return;
    }

    button.disabled = true;
    button.textContent = "Creando equipo...";

    const { data: teamId, error } =
      await client.rpc("create_team", {
        p_name: name,
        p_description: description,
        p_sport: sport || "Fútbol",
        p_currency: currency || "ARS",
        p_country: country || "Argentina"
      });

    if (error) {
      button.disabled = false;
      button.textContent = "Crear mi equipo";
      errorBox.textContent =
        "No se pudo crear el equipo: " + error.message;
      errorBox.classList.remove("hidden");
      return;
    }

    // El RPC crea también player_accounts y team_members para el creador.
onboardingPage.classList.add("hidden");
await loadApplication();

  }


  async function createTeam(event) {

    event.preventDefault();

    const name =
      document.getElementById("newTeamName").value.trim();

    const description =
      document.getElementById("newTeamDescription").value.trim();

    const sportSelect =
      document.getElementById("newTeamSport");

    const sportOther =
      document.getElementById("newTeamSportOther");

    let sport =
      sportSelect ? sportSelect.value.trim() : "Fútbol";

    if (sport === "Otro") {
      sport = sportOther ? sportOther.value.trim() : "";
      if (!sport) {
        showAdminError("Escribí el nombre del deporte.");
        return;
      }
    }

    const currency =
      document.getElementById("newTeamCurrency").value;

    const country =
      document.getElementById("newTeamCountry").value.trim();

    if (!name) {
      showAdminError(
        "El nombre del equipo es obligatorio."
      );
      return;
    }

    const button =
      event.submitter ||
      document.querySelector(
        "#createTeamForm button[type='submit']"
      );

    if (button) {
      button.disabled = true;
      button.textContent = "Creando...";
    }

    const {
      data: teamId,
      error
    } = await client.rpc(
      "create_team",
      {
        p_name: name,
        p_description: description,
        p_sport: sport || "Fútbol",
        p_currency: currency || "ARS",
        p_country: country || "Argentina"
      }
    );

    if (button) {
      button.disabled = false;
      button.textContent = "Crear equipo";
    }

    if (error) {
      showAdminError(
        "No se pudo crear el equipo: " +
        error.message
      );
      return;
    }

    const {
      data: adminTeams,
      error: teamsError
    } = await client.rpc("my_admin_teams");

    if (teamsError) {
      showAdminError(
        "El equipo se creó, pero no pudimos actualizar la lista: " +
        teamsError.message
      );
      return;
    }

    myAdminTeams =
      (adminTeams || []).map(normalizeTeam);

    currentTeam =
      myAdminTeams.find(
        team => team.id === teamId
      ) ||
      currentTeam;

    document.getElementById(
      "createTeamForm"
    ).reset();

    document.getElementById(
      "newTeamSport"
    ).value = "Fútbol";

    document.getElementById(
      "newTeamSportOther"
    ).value = "";

    document.getElementById(
      "newTeamSportOther"
    ).style.display = "none";

    document.getElementById(
      "newTeamCurrency"
    ).value = "ARS";

    document.getElementById(
      "newTeamCountry"
    ).value = "Argentina";

    showAdminSuccess(
      "Equipo creado correctamente."
    );

    renderCurrentTeam();
    await loadAdminDashboard();

  }


  /* =====================================================
     CONCEPTOS DE COBRO
  ===================================================== */

 async function loadChargeConcepts() {

  if (!currentTeam) return;

  const container =
    document.getElementById("chargeConcepts");

  if (!container) return;

  const {
    data: concepts,
    error
  } = await client
    .from("charge_concepts")
    .select("*")
    .eq("team_id", currentTeam.id)
    .eq("active", true)
    .order("created_at");

  if (error) {

    container.innerHTML =
      `<p class="muted">No se pudieron cargar los conceptos.</p>`;

    showAdminError(
      "No pudimos cargar los conceptos: " +
      error.message
    );

    return;
  }

  if (!concepts.length) {

    container.innerHTML =
      `<p class="muted">Todavía no hay conceptos creados.</p>`;

    return;
  }

  container.innerHTML = concepts.map(concept => `

    <div class="concept-row">

      <div>
        <strong>${escapeHtml(concept.name)}</strong>
      </div>

      <div>
        ${money(concept.amount)}
      </div>

      <div class="muted">
        ${conceptFrequencyLabel(concept.frequency)}
      </div>

      <div class="concept-actions">

        <button
          class="btn-secondary"
          type="button"
          onclick="editChargeConcept('${concept.id}')"
        >
          ✏️ Editar
        </button>

        <button
          class="btn-primary"
          type="button"
          onclick="openApplyConcept('${concept.id}')"
        >
          ➕ Aplicar
        </button>

        <button
          class="btn-danger"
          type="button"
          onclick="deactivateConcept('${concept.id}')"
        >
          Quitar
        </button>

      </div>

    </div>

  `).join("");
}

function conceptFrequencyLabel(frequency) {

  if (frequency === "monthly") {
    return "Mensual";
  }

  if (frequency === "match") {
    return "Por partido";
  }

  if (frequency === "tournament") {
    return "Por torneo";
  }

  if (frequency === "eventual") {
    return "Eventual";
  }

  if (frequency === "annual") {
    return "Anual";
  }

  return "Único";
}


function toggleChargeConceptsPanel() {

  const panel =
    document.getElementById("chargeConceptsConfig");

  const toggle =
    document.getElementById("chargeConceptsToggle");

  if (!panel) return;

  if (
    panel.style.display === "none" ||
    panel.style.display === ""
  ) {

    panel.style.display = "block";

    if (toggle) {
      toggle.textContent = "▲";
    }

  } else {

    panel.style.display = "none";

    if (toggle) {
      toggle.textContent = "▼";
    }
  }
}

window.toggleChargeConceptsPanel =
  toggleChargeConceptsPanel;
async function editChargeConcept(conceptId) {

  if (!currentTeam) return;

  const {
    data: concept,
    error
  } = await client
    .from("charge_concepts")
    .select("*")
    .eq("id", conceptId)
    .eq("team_id", currentTeam.id)
    .eq("active", true)
    .maybeSingle();

  if (error) {

    showAdminError(
      "No pudimos cargar el concepto: " +
      error.message
    );

    return;
  }

  if (!concept) {

    showAdminError(
      "No encontramos ese concepto."
    );

    return;
  }

  const newName = prompt(
    "Nombre del concepto:",
    concept.name
  );

  if (newName === null) return;

  const cleanName = newName.trim();

  if (!cleanName) {

    showAdminError(
      "El nombre no puede estar vacío."
    );

    return;
  }

  const newAmount = prompt(
    "Monto:",
    concept.amount
  );

  if (newAmount === null) return;

  const amount = Number(newAmount);

  if (!Number.isFinite(amount) || amount < 0) {

    showAdminError(
      "Ingresá un monto válido."
    );

    return;
  }

const frequencyLabels = {
  one_time: "Único",
  monthly: "Mensual",
  match: "Por partido",
  tournament: "Por torneo",
  eventual: "Eventual",
  annual: "Anual"
};

const currentFrequencyLabel =
  frequencyLabels[concept.frequency] ||
  "Único";

const newFrequencyLabel = prompt(
  "Tipo: Único, Mensual, Por partido, Por torneo, Eventual o Anual",
  currentFrequencyLabel
);

if (newFrequencyLabel === null) return;

const frequencyMap = {
  "Único": "one_time",
  "Mensual": "monthly",
  "Por partido": "match",
  "Por torneo": "tournament",
  "Eventual": "eventual",
  "Anual": "annual"
};

const newFrequency =
  frequencyMap[newFrequencyLabel.trim()];

if (!newFrequency) {
  showAdminError(
    "Tipo de concepto no válido."
  );
  return;
}

  if (newFrequency === null) return;

  const allowedFrequencies = [
    "one_time",
    "monthly",
    "match",
    "tournament",
    "eventual",
    "annual"
  ];

  if (!allowedFrequencies.includes(newFrequency)) {

    showAdminError(
      "Tipo de concepto no válido."
    );

    return;
  }

  const {
    error: updateError
  } = await client
    .from("charge_concepts")
    .update({
      name: cleanName,
      amount: amount,
      frequency: newFrequency
    })
    .eq("id", conceptId)
    .eq("team_id", currentTeam.id);

  if (updateError) {

    showAdminError(
      "No se pudo modificar el concepto: " +
      updateError.message
    );

    return;
  }

  showAdminSuccess(
    "Concepto modificado correctamente."
  );

  await loadChargeConcepts();
}
  async function saveChargeConcept(event) {

    event.preventDefault();

    if (!currentTeam) {
      showAdminError("No hay un equipo seleccionado.");
      return;
    }

    const name =
      document.getElementById("conceptName")
        .value
        .trim();

    const amount =
      Number(
        document.getElementById("conceptAmount")
          .value
      );

    const frequency =
      document.getElementById("conceptFrequency")
        .value;

    if (!name) {
      showAdminError("Ingresá un nombre para el concepto.");
      return;
    }

    if (amount < 0) {
      showAdminError("El monto no puede ser negativo.");
      return;
    }

    const {
      error
    } = await client
      .from("charge_concepts")
      .insert({
        team_id: currentTeam.id,
        name: name,
        amount: amount,
        frequency: frequency,
        active: true
      });

    if (error) {
      showAdminError(
        "No se pudo guardar el concepto: " +
        error.message
      );
      return;
    }

    document.getElementById("conceptForm").reset();

    showAdminSuccess(
      "Concepto creado correctamente."
    );

    await loadChargeConcepts();
  }


  let conceptToApply = null;

  async function openApplyConcept(conceptId) {

    if (!currentTeam) return;

    const { data: concept, error: conceptError } = await client
      .from("charge_concepts")
      .select("*")
      .eq("id", conceptId)
      .eq("team_id", currentTeam.id)
      .eq("active", true)
      .single();

    if (conceptError) {
      showAdminError("No pudimos cargar el concepto: " + conceptError.message);
      return;
    }

    const { data: players, error: playersError } = await client
      .from("players")
      .select("id, name, nickname")
      .eq("team_id", currentTeam.id)
      .eq("active", true)
      .order("name");
      console.log("JUGADORES:", players);
      console.log("ERROR:", playersError);
    
    if (playersError) {
      showAdminError("No pudimos cargar los jugadores: " + playersError.message);
      return;
    }

    conceptToApply = concept;

    document.getElementById("applyConceptTitle").textContent =
      "Aplicar: " + concept.name + " — " + money(concept.amount);

    const container = document.getElementById("applyConceptPlayers");

    if (!players.length) {
      container.innerHTML = `<p class="muted">No hay jugadores activos en este equipo.</p>`;
    } else {
      container.innerHTML = players.map(player => `
        <label class="apply-player-item">
          <input type="checkbox" class="apply-player-checkbox" value="${player.id}">
          <span class="apply-player-name">${escapeHtml(player.name)}${player.nickname ? ` (${escapeHtml(player.nickname)})` : ""}</span>
        </label>
      `).join("");
    }

    document.getElementById("applyConceptPanel").style.display = "block";
    document.getElementById("applyConceptPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }


  function closeApplyConcept() {
    conceptToApply = null;
    const panel = document.getElementById("applyConceptPanel");
    if (panel) panel.style.display = "none";
  }


  function selectAllConceptPlayers() {
    document.querySelectorAll(".apply-player-checkbox").forEach(input => {
      input.checked = true;
    });
  }


  function clearConceptPlayers() {
    document.querySelectorAll(".apply-player-checkbox").forEach(input => {
      input.checked = false;
    });
  }


  async function applyConceptToSelected() {

    if (!currentTeam || !conceptToApply) {
      showAdminError("No hay un concepto seleccionado.");
      return;
    }

    const selected = Array.from(
      document.querySelectorAll(".apply-player-checkbox:checked")
    ).map(input => input.value);

    if (!selected.length) {
      showAdminError("Seleccioná al menos un jugador.");
      return;
    }

    const confirmed = confirm(
      `¿Generar el cargo de ${money(conceptToApply.amount)} para ${selected.length} jugador(es) por “${conceptToApply.name}”?`
    );

    if (!confirmed) return;

    const rows = selected.map(playerId => ({
      team_id: currentTeam.id,
      player_id: playerId,
      charge_type: "concept",
      description: conceptToApply.name,
      amount: Number(conceptToApply.amount),
      match_id: null,
      due_date: null
    }));

    const { error } = await client
      .from("charges")
      .insert(rows);

    if (error) {
      showAdminError("No se pudieron generar los cargos: " + error.message);
      return;
    }

    showAdminSuccess(
      `Se generaron ${selected.length} cargo(s) de ${money(conceptToApply.amount)}.`
    );

    closeApplyConcept();
    await loadAdminDashboard();
  }

  async function deactivateConcept(conceptId) {

    if (!currentTeam) return;

    const {
      error
    } = await client
      .from("charge_concepts")
      .update({
        active: false
      })
      .eq("id", conceptId)
      .eq("team_id", currentTeam.id);

    if (error) {
      showAdminError(
        "No se pudo quitar el concepto: " +
        error.message
      );
      return;
    }

    showAdminSuccess(
      "Concepto quitado."
    );

    await loadChargeConcepts();
  }

/* =====================================================
   PARTIDOS
===================================================== */

function toggleMatchForm() {

  const form = document.getElementById("matchForm");

  if (!form) return;

  const opening =
    form.style.display === "none" ||
    !form.style.display;

  form.style.display =
    opening ? "grid" : "none";

}


async function loadMatches() {

  if (!currentTeam) return;

  const container =
    document.getElementById("matchesList");

  if (!container) return;

  container.innerHTML = "Cargando...";


  const {
    data: matches,
    error
  } = await client
    .from("matches")
    .select("*")
    .eq("team_id", currentTeam.id)
    .order("match_date", {
      ascending: true
    })
    .order("match_time", {
      ascending: true
    });


  if (error) {

    container.innerHTML =
      `<p class="muted">
        No pudimos cargar los partidos.
      </p>`;

    showAdminError(
      "No pudimos cargar los partidos: " +
      error.message
    );

    return;

  }


  if (!matches || !matches.length) {

    container.innerHTML =
      `<p class="muted">
        Todavía no hay partidos cargados.
      </p>`;

    return;

  }


  container.innerHTML = `
    <div
      style="
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));
        gap:12px;
      "
    >

      ${matches.map(match => {

        const published =
          !!match.published_at;

        return `
          <div
            class="payment"
            style="margin:0;"
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:15px;
                flex-wrap:wrap;
              "
            >

              <div>

                <strong>
                  ⚽ ${escapeHtml(
                    match.opponent ||
                    "Partido"
                  )}
                </strong>

                <p style="margin:6px 0;">
                  📅 ${formatDate(match.match_date)}
                  ${
                    match.match_time
                      ? ` · ⏰ ${escapeHtml(
                          match.match_time.substring(0,5)
                        )}`
                      : ""
                  }
                </p>

                <p
                  class="muted"
                  style="margin:4px 0;"
                >
                  📍 ${escapeHtml(
                    match.venue ||
                    "Lugar a confirmar"
                  )}
                </p>

                <p
                  class="muted"
                  style="margin:4px 0;"
                >
                  💰 ${money(
                    match.fee_per_player
                  )}
                </p>

                ${
                  match.notes
                    ? `
                      <p
                        class="muted"
                        style="margin:4px 0;"
                      >
                        📝 ${escapeHtml(
                          match.notes
                        )}
                      </p>
                    `
                    : ""
                }

              </div>


              <div style="text-align:right;">

                ${
                  published
                    ? `
                      <span class="status status-approved">
                        Publicado
                      </span>
                    `
                    : `
                      <span class="status status-pending">
                        Borrador
                      </span>
                    `
                }

              </div>

            </div>


            <div
              style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                margin-top:12px;
              "
            >

              ${
                published
                  ? `
                    <button
                      class="btn-secondary"
                      type="button"
                      onclick="setMatchPublished('${match.id}', false)"
                    >
                      ↩️ Despublicar
                    </button>
                  `
                  : `
                    <button
                      class="btn-success"
                      type="button"
                      onclick="setMatchPublished('${match.id}', true)"
                    >
                      📢 Publicar
                    </button>
                  `
              }

              <button
                class="btn-danger"
                type="button"
                onclick="deleteMatch('${match.id}')"
              >
                🗑️ Eliminar
              </button>

            </div>

          </div>
        `;

      }).join("")}

    </div>
  `;

}


async function createMatch() {

  if (!currentTeam) {

    showAdminError(
      "No hay un equipo seleccionado."
    );

    return;

  }


  const matchDate =
    document
      .getElementById("newMatchDate")
      .value;

  const matchTime =
    document
      .getElementById("newMatchTime")
      .value;

  const opponent =
    document
      .getElementById("newMatchOpponent")
      .value
      .trim();

  const venue =
    document
      .getElementById("newMatchVenue")
      .value
      .trim();

  const fee =
    Number(
      document
        .getElementById("newMatchFee")
        .value
    );

  const notes =
    document
      .getElementById("newMatchNotes")
      .value
      .trim();


  if (!matchDate) {

    showAdminError(
      "Seleccioná la fecha del partido."
    );

    return;

  }


  if (fee < 0) {

    showAdminError(
      "El valor por jugador no puede ser negativo."
    );

    return;

  }


  const {
    error
  } = await client
    .from("matches")
    .insert({

      team_id:
        currentTeam.id,

      match_date:
        matchDate,

      match_time:
        matchTime || null,

      opponent:
        opponent || null,

      venue:
        venue || null,

      fee_per_player:
        fee || 0,

      notes:
        notes || null,

      published_at:
        null

    });


  if (error) {

    showAdminError(
      "No se pudo crear el partido: " +
      error.message
    );

    return;

  }


  document
    .getElementById("newMatchDate")
    .value = "";

  document
    .getElementById("newMatchTime")
    .value = "";

  document
    .getElementById("newMatchOpponent")
    .value = "";

  document
    .getElementById("newMatchVenue")
    .value = "";

  document
    .getElementById("newMatchFee")
    .value = "";

  document
    .getElementById("newMatchNotes")
    .value = "";


  document
    .getElementById("matchForm")
    .style.display = "none";


  showAdminSuccess(
    "Partido creado correctamente."
  );


  await loadMatches();

}


async function publishMatch(matchId) {

if (!currentTeam) return;

  const confirmed =
    confirm(
      "¿Querés despublicar este partido? Dejará de estar visible para los jugadores."
    );

  if (!confirmed) return;


  const {
    data,
    error
  } = await client
    .from("matches")
    .update({
      published_at: null
    })
    .eq("id", matchId)
    .eq("team_id", currentTeam.id)
    .select("id, published_at")
    .maybeSingle();


  if (error) {

    showAdminError(
      "No se pudo despublicar el partido: " +
      error.message
    );

    return;

  }


  if (!data) {

    showAdminError(
      "No encontramos el partido para despublicarlo."
    );

    return;

  }


  showAdminSuccess(
    "Partido despublicado correctamente."
  );


  await loadMatches();

}

async function unpublishMatch(matchId) {

  if (!currentTeam) return;

  const confirmed =
    confirm(
      "¿Querés despublicar este partido? Dejará de estar visible para los jugadores."
    );

  if (!confirmed) return;


  const {
    error
  } = await client
    .from("matches")
    .update({
      published_at: null
    })
    .eq("id", matchId)
    .eq("team_id", currentTeam.id);


  if (error) {

    showAdminError(
      "No se pudo despublicar el partido: " +
      error.message
    );

    return;

  }


  showAdminSuccess(
    "Partido despublicado correctamente."
  );


  await loadMatches();
  
}

async function setMatchPublished(matchId, shouldPublish) {
  if (!currentTeam) return;

  const confirmed = confirm(
    shouldPublish
      ? "¿Querés publicar este partido para los jugadores del equipo?"
      : "¿Querés despublicar este partido? Dejará de estar visible para los jugadores."
  );

  if (!confirmed) return;

  const { data, error } = await client
    .from("matches")
    .update({
      published_at: shouldPublish
        ? new Date().toISOString()
        : null
    })
    .eq("id", matchId)
    .eq("team_id", currentTeam.id)
    .select("id, published_at")
    .maybeSingle();
  if (error) {
    showAdminError(
      (shouldPublish
        ? "No se pudo publicar el partido: "
        : "No se pudo despublicar el partido: ") +
      error.message
    );
    return;
  }

  if (!data) {
    showAdminError(
      "No encontramos el partido para actualizar."
    );
    return;
  }

  showAdminSuccess(
    shouldPublish
      ? "Partido publicado correctamente."
      : "Partido despublicado correctamente."
  );

  await loadMatches();
}
async function deleteMatch(matchId) {

  if (!currentTeam) return;

  const confirmed =
    confirm(
      "¿Querés eliminar este partido?"
    );

  if (!confirmed) return;


  const {
    error
  } = await client
    .from("matches")
    .delete()
    .eq("id", matchId)
    .eq("team_id", currentTeam.id);


  if (error) {

    showAdminError(
      "No se pudo eliminar el partido: " +
      error.message
    );

    return;

  }


  showAdminSuccess(
    "Partido eliminado correctamente."
  );


  await loadMatches();

}
  async function loadArchivedTeams() {

    const container =
      document.getElementById("archivedTeams");

    if (!container) return;

    container.innerHTML = "Cargando...";

    const { data, error } =
      await client
        .from("teams")
        .select("id, name, description, sport, country, currency, active")
        .eq("active", false)
        .order("created_at", { ascending: false });

    if (error) {
      container.innerHTML =
        `<p class="muted">No pudimos cargar los equipos archivados.</p>`;
      return;
    }

    const archivedTeams = data || [];

    if (!archivedTeams.length) {
      container.innerHTML =
        `<p class="muted">No tenés equipos archivados.</p>`;
      return;
    }

    container.innerHTML = archivedTeams.map(team => `
      <div class="payment" style="margin-bottom:10px;">
        <strong>${escapeHtml(team.name)}</strong>
        <p class="muted" style="margin:4px 0;">
          ${escapeHtml(team.description || "Equipo deportivo amateur")}
        </p>
        <p class="muted" style="margin:4px 0 10px;">
          ${escapeHtml(team.sport || "")}
          · ${escapeHtml(team.country || "")}
          · ${escapeHtml(team.currency || "")}
        </p>
        <button
          type="button"
          class="btn-primary"
          onclick="restoreArchivedTeam('${team.id}')"
        >
          ♻️ Reactivar equipo
        </button>
      </div>
    `).join("");

  }


  async function restoreArchivedTeam(teamId) {

    const { data: archivedTeam } =
      await client
        .from("teams")
        .select("id, name")
        .eq("id", teamId)
        .eq("active", false)
        .maybeSingle();

    if (!archivedTeam) {
      showAdminError("No encontramos ese equipo archivado.");
      return;
    }

    const confirmed = confirm(
      `¿Querés reactivar el equipo "${archivedTeam.name}"?\n\n` +
      `Volverá a aparecer entre tus equipos activos y podrás administrarlo nuevamente.`
    );

    if (!confirmed) return;

    hideAdminMessages();

    const { error } = await client.rpc(
      "restore_team",
      { p_team_id: teamId }
    );

    if (error) {
      showAdminError("No se pudo reactivar el equipo: " + error.message);
      return;
    }

    const { data: adminTeams, error: teamsError } =
      await client.rpc("my_admin_teams");

    if (teamsError) {
      showAdminError("El equipo fue reactivado, pero no pudimos actualizar la lista: " + teamsError.message);
      return;
    }

    myAdminTeams =
      (adminTeams || [])
        .map(normalizeTeam)
        .filter(team => team.active !== false);

    currentTeam =
      myAdminTeams.find(team => team.id === teamId) ||
      currentTeam ||
      myAdminTeams[0] ||
      null;

    if (currentTeam) {
      renderCurrentTeam();
      await loadAdminDashboard();
    }

    await loadArchivedTeams();
    showAdminSuccess(`El equipo "${archivedTeam.name}" fue reactivado correctamente.`);

  }


  async function archiveCurrentTeam() {

    if (!currentTeam) {
      showAdminError("No hay un equipo seleccionado.");
      return;
    }

    const teamName = currentTeam.name;

    const confirmed = confirm(
      `¿Querés archivar el equipo "${teamName}"?\n\n` +
      `El equipo dejará de estar activo, pero se conservarán todos sus jugadores, cargos y pagos.\n\n` +
      `Esta acción no elimina los datos.`
    );

    if (!confirmed) return;

    hideAdminMessages();

    const { error } = await client.rpc(
      "archive_team",
      { p_team_id: currentTeam.id }
    );

    if (error) {
      showAdminError("No se pudo archivar el equipo: " + error.message);
      return;
    }

    myAdminTeams = myAdminTeams.filter(
      team => team.id !== currentTeam.id
    );

    if (!myAdminTeams.length) {
      currentTeam = null;
      showAdminError(
        `El equipo "${teamName}" fue archivado correctamente. Ya no tenés equipos activos para administrar.`
      );
      return;
    }

    currentTeam = myAdminTeams[0];
    renderCurrentTeam();
    await loadArchivedTeams();
    await loadAdminDashboard();
    showAdminSuccess(`El equipo "${teamName}" fue archivado correctamente.`);
  }


  /* =====================================================
     CONFIGURACIÓN DEL EQUIPO
  ===================================================== */

 async function loadTeamSettings() {

  if (!currentTeam) return;

  // La configuración económica del equipo
  // ahora se administra mediante "Conceptos de cobro".
  // Esta función se mantiene para no romper la carga del panel.
}

  async function saveTeamSettings() {

  // La configuración económica del equipo
  // ahora se administra mediante Conceptos de cobro.
  // Se mantiene esta función para compatibilidad con código anterior.

  if (!currentTeam) {
    showAdminError("No hay un equipo seleccionado.");
    return;
  }

  showAdminSuccess(
    "La configuración económica se administra desde Conceptos de cobro."
  );

  await loadChargeConcepts();
}

  /* =====================================================
     ADMIN
  ===================================================== */

  async function loadAdminDashboard() {

    hideAdminMessages();

    await loadTeamSettings();
    await loadChargeConcepts();
    const {
  data: activeConcepts,
  error: activeConceptsError
} = await client
  .from("charge_concepts")
  .select("*")
  .eq("team_id", currentTeam.id)
  .eq("active", true);
    if (activeConceptsError) {
  showAdminError(
    "No pudimos cargar los conceptos activos: " +
    activeConceptsError.message
  );
  return;
}
    
    await loadMatches();
    
    await loadAdminTeamPosts();

    const {
      data: players,
      error: playersError
    } =
      await client
        .from("players")
        .select("*")
        .eq("active", true)
        .eq("team_id", currentTeam.id)
        .order("id");


    if (playersError) {

      showAdminError(
        playersError.message
      );

      return;

    }


    const {
      data: charges,
      error: chargesError
    } =
      await client
        .from("charges")
        .select("*")
        .eq("team_id", currentTeam.id);


    if (chargesError) {

      showAdminError(
        chargesError.message
      );

      return;

    }


    const {
      data: payments,
      error: paymentsError
    } =
      await client
        .from("payments")
        .select("*")
        .eq("team_id", currentTeam.id)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (paymentsError) {

      showAdminError(
        paymentsError.message
      );

      return;

    }


    // El total mostrado en el panel representa la inscripción
    // configurada actualmente multiplicada por los jugadores activos.
    const {
      data: settings
    } = await client
      .from("team_settings")
      .select("registration_fee")
      .eq("team_id", currentTeam.id)
      .maybeSingle();

    const currentRegistrationFee =
      Number(settings?.registration_fee || 0);

   const activePlayerIds =
  players.map(
    player => player.id
  );

const registrationTotal =
  charges
    .filter(
      c =>
        c.charge_type === "registration" &&
        activePlayerIds.includes(
          c.player_id
        )
    )
    .reduce(
      (sum, c) =>
        sum + Number(c.amount || 0),
      0
    );


const approvedPayments =
  payments.filter(
    p =>
      p.status === "approved"
  );


const approvedTotal =
  approvedPayments.reduce(
    (sum, p) =>
      sum + Number(p.amount || 0),
    0
  );


const pendingPayments =
  payments.filter(
    p =>
      p.status === "pending"
  );

const activeConceptAmounts =
  activeConcepts.reduce(
    (map, concept) => {
      map[
        concept.name
          .trim()
          .toLowerCase()
      ] = Number(concept.amount || 0);

      return map;
    },
    {}
  );

const activeConceptNames =
  activeConcepts.map(
    concept =>
      concept.name
        .trim()
        .toLowerCase()
  );

const currentCharges =
  charges.filter(charge => {

    // Los cargos anulados no cuentan para el jugador
    if (charge.active === false) {
      return false;
    }

    // Todo cargo activo asignado al jugador
    // debe aparecer en su panel.
    return true;
  });
    
const playerBalances =
  players.map(player => {

    const chargesTotal =
      currentCharges
        .filter(
          charge =>
            charge.player_id ===
            player.id
        )
        .reduce(
          (sum, charge) =>
            sum +
            Number(
              charge.amount || 0
            ),
          0
        );

    const paidTotal =
      payments
        .filter(
          payment =>
            payment.player_id ===
              player.id &&
            payment.status ===
              "approved"
        )
        .reduce(
          (sum, payment) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        );

    return (
      paidTotal -
      chargesTotal
    );
  });

const totalCredits =
  playerBalances
    .filter(
      value => value > 0
    )
    .reduce(
      (sum, value) =>
        sum + value,
      0
    );

const totalDebts =
  playerBalances
    .filter(
      value => value < 0
    )
    .reduce(
      (sum, value) =>
        sum + Math.abs(value),
      0
    );
    document.getElementById(
      "statPlayers"
    ).textContent =
      players.length;


    document.getElementById(
      "statCharges"
    ).textContent =
      money(registrationTotal);


    document.getElementById(
      "statApproved"
    ).textContent =
      money(approvedTotal);


    document.getElementById(
      "statPending"
    ).textContent =
      pendingPayments.length;

    document.getElementById("statCredits").textContent =
      money(totalCredits);

    document.getElementById("statDebts").textContent =
      money(totalDebts);



    renderPendingPayments(
      pendingPayments,
      players
    );


    renderPlayers(
      players,
      charges,
      payments,
      currentRegistrationFee,
      activeConcepts
    );

  }


  /* =====================================================
     GESTIÓN DE JUGADORES
  ===================================================== */

  function toggleAddPlayerForm() {
    const form = document.getElementById("addPlayerForm");
    if (!form) return;

    const opening = form.style.display === "none" || !form.style.display;
    form.style.display = opening ? "grid" : "none";

    if (opening) {
      document.getElementById("newPlayerName")?.focus();
    }
  }

 async function addPlayer() {

  if (!currentTeam) {
    showAdminError("No hay un equipo seleccionado.");
    return;
  }

  const name =
    document.getElementById("newPlayerName")
      .value
      .trim();

  const nickname =
    document.getElementById("newPlayerNickname")
      .value
      .trim();

  const dni =
    document.getElementById("newPlayerDni")
      .value
      .trim();

  if (!name) {
    showAdminError(
      "Ingresá el nombre del jugador."
    );
    return;
  }

  const {
    count,
    error: countError
  } = await client
    .from("players")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("team_id", currentTeam.id)
    .eq("active", true);

  if (countError) {
    showAdminError(
      "No pudimos comprobar la cantidad de jugadores: " +
      countError.message
    );
    return;
  }

  if ((count || 0) >= 50) {
    showAdminError(
      "Este equipo ya alcanzó el máximo de 50 jugadores."
    );
    return;
  }


  /*
   * 1. Crear jugador
   */

  const {
    data: newPlayer,
    error: playerError
  } = await client
    .from("players")
    .insert({
      team_id: currentTeam.id,
      name: name,
      nickname: nickname || null,
      dni: dni || null,
      active: true
    })
    .select()
    .single();

  if (playerError) {
    showAdminError(
      "No se pudo agregar el jugador: " +
      playerError.message
    );
    return;
  }


  

  /*
   * 4. Limpiar formulario
   */

  document.getElementById(
    "newPlayerName"
  ).value = "";

  document.getElementById(
    "newPlayerNickname"
  ).value = "";

  document.getElementById(
    "newPlayerDni"
  ).value = "";

  document.getElementById(
    "addPlayerForm"
  ).style.display = "none";


  showAdminSuccess(
    "Jugador agregado correctamente."
  );

  await loadAdminDashboard();
}
  async function editPlayerName(playerId, currentName) {

    const newName = prompt("Modificar nombre del jugador:", currentName);

    if (newName === null) return;

    const trimmed = newName.trim();

    if (!trimmed) {
      showAdminError("El nombre no puede quedar vacío.");
      return;
    }

    if (trimmed === currentName) return;

    const { error } = await client
      .from("players")
      .update({ name: trimmed })
      .eq("id", playerId)
      .eq("team_id", currentTeam.id);

    if (error) {
      showAdminError("No se pudo modificar el jugador: " + error.message);
      return;
    }

    showAdminSuccess("Jugador modificado correctamente.");
    await loadAdminDashboard();
  }
async function editPlayerDni(playerId, currentDni) {

  const newDni = prompt(
    "Modificar DNI del jugador:",
    currentDni || ""
  );

  if (newDni === null) return;

  const trimmed = newDni.trim();

  const { error } = await client
    .from("players")
    .update({
      dni: trimmed || null
    })
    .eq("id", playerId)
    .eq("team_id", currentTeam.id);

  if (error) {
    showAdminError(
      "No se pudo modificar el DNI: " +
      error.message
    );
    return;
  }

  showAdminSuccess(
    "DNI modificado correctamente."
  );

  await loadAdminDashboard();
}
 async function editPlayerData(
  playerId,
  currentName,
  currentNickname,
  currentDni
) {

  const newName = prompt(
    "Nombre del jugador:",
    currentName || ""
  );

  if (newName === null) return;

  const newNickname = prompt(
    "Apodo:",
    currentNickname || ""
  );

  if (newNickname === null) return;

  const newDni = prompt(
    "DNI:",
    currentDni || ""
  );

  if (newDni === null) return;

  const name = newName.trim();
  const nickname = newNickname.trim();
  const dni = newDni.trim();

  if (!name) {
    showAdminError(
      "El nombre no puede quedar vacío."
    );
    return;
  }

  const { error } = await client
    .from("players")
    .update({
      name: name,
      nickname: nickname || null,
      dni: dni || null
    })
    .eq("id", playerId)
    .eq("team_id", currentTeam.id);

  if (error) {
    showAdminError(
      "No se pudieron guardar los datos: " +
      error.message
    );
    return;
  }

  showAdminSuccess(
    "Datos del jugador actualizados correctamente."
  );

  await loadAdminDashboard();
}
async function removePlayer(playerId, playerName) {

    const confirmed = confirm(
      `¿Quitar a ${playerName} del equipo?\n\nSu historial de cargos y pagos se conservará, pero dejará de aparecer entre los jugadores activos.`
    );

    if (!confirmed) return;

    const { error } = await client
      .from("players")
      .update({ active: false })
      .eq("id", playerId)
      .eq("team_id", currentTeam.id);

    if (error) {
      showAdminError("No se pudo quitar el jugador: " + error.message);
      return;
    }

    showAdminSuccess(`${playerName} fue quitado del equipo. El historial se conservó.`);
    await loadAdminDashboard();
  }


  /* =====================================================
     TABLA JUGADORES ADMIN
  ===================================================== */

  function renderPlayers(
    players,
    charges,
    payments,
    currentRegistrationFee,
    activeConcepts
  ) {

    const table =
      document.getElementById(
        "playersTable"
      );

    table.innerHTML = "";

    const countBox = document.getElementById("playersCount");
    if (countBox) {
      countBox.textContent = `${players.length} / 50 jugadores`;
    }


    players.forEach(player => {

  const playerCharges =
  charges
    .filter(c => c.player_id === player.id)
    .filter(c => c.active !== false)
    .reduce(
      (sum, c) =>
        sum + Number(c.amount || 0),
      0
    );
const playerPaid =
  payments
    .filter(
      payment =>
        payment.player_id === player.id &&
        payment.status === "approved"
    )
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    );

const activeConceptNames =
  activeConcepts.map(
    concept =>
      concept.name
        .trim()
        .toLowerCase()
  );
      const difference =
        playerPaid - playerCharges;

      const balanceText =
        difference > 0
          ? `<span class="positive">A favor ${money(difference)}</span>`
          : difference < 0
            ? `<span class="negative">Debe ${money(Math.abs(difference))}</span>`
            : `<span class="positive">${money(0)}</span>`;


      const row =
  document.createElement("tr");

const playerChargesList =
  charges
    .filter(c => c.player_id === player.id)
    .filter(c => c.active !== false)
    .filter(c => {
      const chargeName =
        (c.description || "")
          .trim()
          .toLowerCase();

      if (
        c.charge_type === "registration" &&
        activeConceptNames.includes("inscripción")
      ) {
        return true;
      }

      return activeConceptNames.includes(chargeName);
    });
      row.innerHTML = `
  <td>
    ${escapeHtml(player.name)}
    ${player.nickname ? `<span class="muted"> (${escapeHtml(player.nickname)})</span>` : ""}
  </td>

  <td>
    ${escapeHtml(player.dni || "-")}
  </td>

 <td>
  <button
    class="btn-secondary"
    type="button"
    onclick='showPlayerCharges(${JSON.stringify(playerChargesList)})'
  >
    ${money(playerCharges)}
  </button>
</td>

  <td class="positive">
    ${money(playerPaid)}
  </td>

  <td>
    ${balanceText}
  </td>

  <td>
    <div class="player-actions">

      <button
        class="btn-secondary"
        type="button"
        onclick="editPlayerData(
          '${player.id}',
          '${escapeHtml(player.name).replace(/'/g, "\\'")}',
          '${escapeHtml(player.nickname || "").replace(/'/g, "\\'")}',
          '${escapeHtml(player.dni || "").replace(/'/g, "\\'")}'
        )"
      >
        ✏️ Editar
      </button>
<button
  class="btn-secondary"
  type="button"
  onclick="managePlayerCharges(
    '${player.id}',
    '${escapeHtml(player.name).replace(/'/g, "\\'")}'
  )"
>
  💰 Cargos
</button>
      <button
        class="btn-danger-small"
        type="button"
        onclick="removePlayer(
          '${player.id}',
          '${escapeHtml(player.name).replace(/'/g, "\\'")}'
        )"
      >
        Quitar
      </button>

    </div>
  </td>
`;

      table.appendChild(row);

    });

  }


  /* =====================================================
     PAGOS PENDIENTES ADMIN
  ===================================================== */
async function showPlayerCharges(playerCharges) {

  if (!Array.isArray(playerCharges) || !playerCharges.length) {
    showAdminError("Este jugador no tiene cargos registrados.");
    return;
  }

  const lines = playerCharges.map(charge => {
    const name =
      charge.description ||
      charge.charge_type ||
      "Cargo";

    return `${name}: ${money(charge.amount)}`;
  });

  alert(
    "Cargos del jugador\n\n" +
    lines.join("\n")
  );
}
async function managePlayerCharges(
  playerId,
  playerName
) {
  if (!currentTeam) {
    showAdminError("No hay un equipo seleccionado.");
    return;
  }

  const modal =
    document.getElementById(
      "playerChargesModal"
    );

  const title =
    document.getElementById(
      "playerChargesModalTitle"
    );

  const subtitle =
    document.getElementById(
      "playerChargesModalSubtitle"
    );

  const list =
    document.getElementById(
      "playerChargesList"
    );

  if (!modal || !title || !subtitle || !list) {
    showAdminError(
      "No se encontró la ventana de cargos."
    );
    return;
  }

  title.textContent =
    "💰 Cargos de " + playerName;

  subtitle.textContent =
    "Cargos registrados para este jugador";

  list.innerHTML =
    "Cargando...";

  modal.style.display =
    "block";

  modal.dataset.playerId =
    playerId;

  modal.dataset.playerName =
    playerName;

  const {
    data: charges,
    error
  } = await client
    .from("charges")
    .select("*")
    .eq("team_id", currentTeam.id)
    .eq("active", true)
    .eq("player_id", playerId)
    .order("created_at", {
      ascending: false
    });

  if (error) {
  console.error("ERROR AL GUARDAR CARGO:", error);

  alert(
    "NO SE PUDO GUARDAR EL CARGO\n\n" +
    "Mensaje: " + (error.message || "-") +
    "\n\nCódigo: " + (error.code || "-") +
    "\n\nDetalle: " + (error.details || "-") +
    "\n\nSugerencia: " + (error.hint || "-")
  );

  return;
}

  if (!charges || !charges.length) {
    list.innerHTML =
      `<p class="muted">
        Este jugador no tiene cargos registrados.
      </p>`;

    hideAddPlayerChargeForm();

    return;
  }

  list.innerHTML =
    charges
      .map(charge => {

        const name =
          charge.description ||
          charge.charge_type ||
          "Cargo";

         return `
          <div
            style="
              padding:12px;
              border:1px solid #ddd;
              border-radius:10px;
              margin-bottom:10px;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:12px;
                align-items:center;
              "
            >
              <strong>
                ${escapeHtml(name)}
              </strong>

              <strong>
                ${money(charge.amount)}
              </strong>
            </div>

            ${
              charge.charge_type
                ? `
                  <div
                    class="muted"
                    style="margin-top:4px;"
                  >
                    Tipo:
                    ${escapeHtml(charge.charge_type)}
                  </div>
                `
                : ""
            }

            <div
              class="muted"
              style="margin-top:4px;"
            >
              Registrado:
              ${
                charge.created_at
                  ? new Date(
                      charge.created_at
                    ).toLocaleDateString("es-AR")
                  : "-"
              }
            </div>

            <div
              style="
                margin-top:10px;
                text-align:right;
              "
            >
              <button
                class="btn-danger-small"
                type="button"
                onclick="deactivatePlayerCharge('${charge.id}')"
              >
                🗑️ Anular
              </button>
            </div>

          </div>
        `;
      })
      .join("");

  hideAddPlayerChargeForm();
}
  
async function deactivatePlayerCharge(chargeId) {
  if (!currentTeam) {
    showAdminError("No hay un equipo seleccionado.");
    return;
  }

  const confirmed = confirm(
    "¿Querés anular este cargo?\n\n" +
    "El cargo quedará guardado en el historial, " +
    "pero dejará de contar como deuda vigente."
  );

  if (!confirmed) return;

  const { error } = await client
    .from("charges")
    .update({
      active: false
    })
    .eq("id", chargeId)
    .eq("team_id", currentTeam.id);

  if (error) {
    console.error("ERROR AL ANULAR CARGO:", error);

    showAdminError(
      "No se pudo anular el cargo: " +
      error.message
    );

    return;
  }

  showAdminSuccess(
    "Cargo anulado correctamente."
  );

  const modal =
    document.getElementById(
      "playerChargesModal"
    );

  const playerId =
    modal?.dataset.playerId;

  const playerName =
    modal?.dataset.playerName ||
    "Jugador";

  if (playerId) {
    await managePlayerCharges(
      playerId,
      playerName
    );
  }

  await loadAdminDashboard();
}
    
 function closePlayerChargesModal() {
  const modal =
    document.getElementById("playerChargesModal");

  if (modal) {
    modal.style.display = "none";
  }

  const form =
    document.getElementById("addPlayerChargeForm");

  if (form) {
    form.style.display = "none";
  }
}


async function showAddPlayerChargeForm() {
  if (!currentTeam) {
    showAdminError("No hay un equipo seleccionado.");
    return;
  }

  const form =
    document.getElementById("addPlayerChargeForm");

  const select =
    document.getElementById("playerChargeConcept");

  if (!form || !select) {
    showAdminError(
      "No se encontró el formulario de cargos."
    );
    return;
  }

  select.innerHTML =
    `<option value="">
      Seleccionar concepto...
    </option>`;

  const {
    data: concepts,
    error
  } = await client
    .from("charge_concepts")
    .select("*")
    .eq("team_id", currentTeam.id)
    .eq("active", true)
    .order("name");

if (error) {
  console.error("ERROR AL GUARDAR CARGO:", error);

  alert(
    "ERROR SUPABASE\n\n" +
    "Mensaje: " + (error.message || "-") +
    "\n\nCódigo: " + (error.code || "-") +
    "\n\nDetalle: " + (error.details || "-") +
    "\n\nSugerencia: " + (error.hint || "-")
  );

  return;
}
  
  if (!concepts || !concepts.length) {
    select.innerHTML =
      `<option value="">
        No hay conceptos activos
      </option>`;
  } else {
    concepts.forEach(concept => {

      const option =
        document.createElement("option");

      option.value = concept.id;

      option.textContent =
        concept.name +
        " — " +
        money(concept.amount);

      option.dataset.amount =
        concept.amount;

      option.dataset.name =
        concept.name;

      option.dataset.type =
        concept.frequency || "eventual";

      select.appendChild(option);
    });
  }

  form.style.display = "block";
}


function hideAddPlayerChargeForm() {
  const form =
    document.getElementById("addPlayerChargeForm");

  if (!form) return;

  form.style.display = "none";
} 
async function savePlayerCharge() {
  alert("savePlayerCharge se está ejecutando");
  
  if (!currentTeam) {
    showAdminError("No hay un equipo seleccionado.");
    return;
  }

  const modal =
    document.getElementById("playerChargesModal");

  const playerId =
    modal?.dataset.playerId;

  const conceptSelect =
    document.getElementById("playerChargeConcept");

  const descriptionInput =
    document.getElementById(
      "playerChargeDescription"
    );

  const amountInput =
    document.getElementById(
      "playerChargeAmount"
    );

  if (!playerId) {
    showAdminError(
      "No se encontró el jugador."
    );
    return;
  }

 const selectedOption =
  conceptSelect?.selectedOptions?.[0];

const description =
  descriptionInput?.value.trim() ||
  selectedOption?.dataset.name ||
  selectedOption?.textContent
    ?.split("—")[0]
    ?.trim() ||
  "";

const amount =
  Number(amountInput?.value) ||
  Number(selectedOption?.dataset.amount || 0);

const chargeType = "concept";
  
alert(
  "Datos recibidos:\n\n" +
  "Jugador: " + playerId +
  "\nDescripción: " + description +
  "\nImporte: " + amount +
  "\nTipo: " + chargeType
);
  
  if (!description) {
    showAdminError(
      "Ingresá una descripción para el cargo."
    );
    return;
  }

  if (!amount || amount <= 0) {
    showAdminError(
      "Ingresá un importe válido."
    );
    return;
  }

  const { error } = await client
    .from("charges")
    .insert({
      team_id: currentTeam.id,
      player_id: playerId,
      charge_type: chargeType,
      description: description,
      amount: amount
    });
if (error) {
  console.error("ERROR AL GUARDAR CARGO:", error);

  alert(
    "NO SE PUDO GUARDAR EL CARGO\n\n" +
    "Mensaje: " + (error.message || "-") +
    "\n\nCódigo: " + (error.code || "-") +
    "\n\nDetalle: " + (error.details || "-") +
    "\n\nSugerencia: " + (error.hint || "-")
  );

  return;
}

  showAdminSuccess(
    "Cargo agregado correctamente."
  );

  descriptionInput.value = "";
  amountInput.value = "";

  await managePlayerCharges(
  playerId,
  modal.dataset.playerName || "Jugador"
);

  await loadAdminDashboard();
}

function renderPendingPayments(
    payments,
    players
  ) {

    const container =
      document.getElementById(
        "pendingPayments"
      );

    container.innerHTML = "";


    if (!payments.length) {

      container.innerHTML =
        `<p class="muted">
          No hay pagos pendientes.
        </p>`;

      return;

    }


    payments.forEach(payment => {

      const player =
        players.find(
          p =>
            p.id ===
            payment.player_id
        );


      const div =
        document.createElement("div");

      div.className =
        "payment";


      div.innerHTML = `
        <strong>
          ${escapeHtml(
            player
              ? player.name
              : "Jugador"
          )}
        </strong>

        <p>
          Monto:
          <strong>
            ${money(payment.amount)}
          </strong>
        </p>

        <p>
          Medio:
          ${escapeHtml(
            payment.payment_method
          )}
        </p>

        <p>
          Fecha:
          ${formatDate(payment.payment_date)}
        </p>

        <div class="payment-actions">

          ${
            payment.receipt_url
            ?
            `<button
              class="btn-secondary"
              onclick="viewReceipt('${payment.receipt_url}')"
            >
              📎 Ver comprobante
            </button>`
            :
            ""
          }

          <button
            class="btn-success"
            onclick="approvePayment('${payment.id}')"
          >
            ✅ Aprobar
          </button>

          <button
            class="btn-danger"
            onclick="rejectPayment('${payment.id}')"
          >
            ❌ Rechazar
          </button>

        </div>
      `;


      container.appendChild(div);

    });

  }


  /* =====================================================
     APROBAR PAGO
  ===================================================== */

  async function approvePayment(
    paymentId
  ) {

    const {
      error
    } =
      await client
        .from("payments")
        .update({
          status: "approved",
          approved_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          paymentId
        )
        .eq(
          "status",
          "pending"
        );


    if (error) {

      showAdminError(
        error.message
      );

      return;

    }


    showAdminSuccess(
      "Pago aprobado correctamente."
    );


    await loadAdminDashboard();

  }


  /* =====================================================
     RECHAZAR PAGO
  ===================================================== */

  async function rejectPayment(
    paymentId
  ) {

    const {
      error
    } =
      await client
        .from("payments")
        .update({
          status: "rejected"
        })
        .eq(
          "id",
          paymentId
        )
        .eq(
          "status",
          "pending"
        );


    if (error) {

      showAdminError(
        error.message
      );

      return;

    }


    showAdminSuccess(
      "Pago rechazado."
    );


    await loadAdminDashboard();

  }


  /* =====================================================
     VER COMPROBANTE
  ===================================================== */

  async function viewReceipt(
    path
  ) {

    const {
      data,
      error
    } =
      await client
        .storage
        .from("comprobantes")
        .createSignedUrl(
          path,
          300
        );


    if (error) {

      alert(
        "No se pudo abrir el comprobante."
      );

      return;

    }


    window.open(
      data.signedUrl,
      "_blank"
    );

  }


  /* =====================================================
     PANEL JUGADOR
  ===================================================== */

  async function loadPlayerDashboard(
    playerId
  ) {

    hidePlayerMessages();


    if (!playerId) {

      showPlayerError(
        "Tu cuenta no está vinculada a un jugador."
      );

      return;

    }


    const {
      data: player,
      error: playerError
    } =
      await client
        .from("players")
        .select("*")
        .eq(
          "id",
          playerId
        )
        .single();


    if (playerError) {

      showPlayerError(
        playerError.message
      );

      return;

    }


    currentPlayer =
      player;

    const {
      data: teamSettings
    } = await client
      .from("team_settings")
      .select("registration_fee")
      .eq("team_id", player.team_id)
      .maybeSingle();

    const currentRegistrationFee =
      Number(teamSettings?.registration_fee || 0);


    const {
      data: charges,
      error: chargesError
    } =
      await client
        .from("charges")
        .select("*")
        .eq(
          "player_id",
          playerId
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (chargesError) {

      showPlayerError(
        chargesError.message
      );

      return;

    }


    const {
      data: payments,
      error: paymentsError
    } =
      await client
        .from("payments")
        .select("*")
        .eq(
          "player_id",
          playerId
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (paymentsError) {

      showPlayerError(
        paymentsError.message
      );

      return;

    }
const {
  data: activeConcepts,
  error: activeConceptsError
} = await client
  .from("charge_concepts")
  .select("*")
  .eq("team_id", player.team_id)
  .eq("active", true);
    
console.log("JUGADOR - conceptos activos:", activeConcepts);
console.log("JUGADOR - cargos:", charges);
if (activeConceptsError) {
  showPlayerError(
    activeConceptsError.message
  );
  return;
}

const activeConceptAmounts =
  activeConcepts.reduce(
    (map, concept) => {
      map[
        concept.name
          .trim()
          .toLowerCase()
      ] = Number(concept.amount || 0);

      return map;
    },
    {}
  );

const activeConceptNames =
  activeConcepts.map(
    concept =>
      concept.name
        .trim()
        .toLowerCase()
  );

const currentCharges =
  charges.filter(charge => {

    // Los cargos anulados no cuentan
    if (charge.active === false) {
      return false;
    }

    // Todo cargo activo asignado al jugador
    // se muestra en su panel.
    return true;
  });
console.log(
  "JUGADOR - cargos que se van a mostrar:",
  currentCharges
);
    
  const totalCharges =
  currentCharges.reduce(
    (sum, charge) =>
      sum + Number(charge.amount || 0),
    0
  );

const totalPaid =
  payments
    .filter(
      payment =>
        payment.status === "approved"
    )
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    );


const pending =
  payments.filter(
    payment =>
      payment.status === "pending"
  );


const balance =
  totalPaid - totalCharges;


const credit =
  Math.max(
    0,
    balance
  );


const debt =
  Math.max(
    0,
    -balance
  );


    document.getElementById(
      "playerWelcome"
    ).textContent =
      "Hola, " +
      player.name;
document.getElementById("playerDataName").textContent =
  player.name || "-";

document.getElementById("playerDataNickname").textContent =
  player.nickname || "-";

document.getElementById("playerDataDni").textContent =
  player.dni || "-";

 document.getElementById(
  "playerPaid"
).textContent =
  money(totalPaid);


// ================================
// ESTADO DEL SALDO DEL JUGADOR
// ================================

const balanceCard =
  document.getElementById(
    "playerBalanceCard"
  );

const balanceTitle =
  document.getElementById(
    "playerBalanceTitle"
  );

const balanceAmount =
  document.getElementById(
    "playerBalanceAmount"
  );

const balanceSubtitle =
  document.getElementById(
    "playerBalanceSubtitle"
  );

const balanceMessage =
  document.getElementById(
    "playerBalanceMessage"
  );

const balanceMessageText =
  document.getElementById(
    "playerBalanceMessageText"
  );


if (balanceCard) {

  // 🔴 DEBE
  if (debt > 0) {

    balanceCard.style.background =
      "#fff1f2";

    balanceCard.style.borderColor =
      "#fecdd3";

    balanceTitle.textContent =
      "🔴 SALDO A PAGAR";

    balanceAmount.textContent =
      money(debt);

    balanceAmount.style.color =
      "#dc2626";

    balanceSubtitle.textContent =
      "Tenés un saldo pendiente";

    balanceMessage.textContent =
      "💪 ¡Vamos equipo!";

    balanceMessageText.textContent =
      "Cuando puedas, ponete al día. ¡Gracias por aportar al equipo!";

  }

  // 💚 SALDO A FAVOR
  else if (credit > 0) {

    balanceCard.style.background =
      "#ecfdf5";

    balanceCard.style.borderColor =
      "#bbf7d0";

    balanceTitle.textContent =
      "💚 SALDO A FAVOR";

    balanceAmount.textContent =
      money(credit);

    balanceAmount.style.color =
      "#16a34a";

    balanceSubtitle.textContent =
      "Tenés saldo disponible";

    balanceMessage.textContent =
      "🙌 ¡Genial!";

    balanceMessageText.textContent =
      "Tenés saldo a favor. Gracias por tu aporte al equipo.";

  }

  // ✅ AL DÍA
  else {

    balanceCard.style.background =
      "#eff6ff";

    balanceCard.style.borderColor =
      "#bfdbfe";

    balanceTitle.textContent =
      "✅ ESTÁS AL DÍA";

    balanceAmount.textContent =
      "$0";

    balanceAmount.style.color =
      "#2563eb";

    balanceSubtitle.textContent =
      "No tenés saldo pendiente";

    balanceMessage.textContent =
      "👏 ¡Excelente!";

    balanceMessageText.textContent =
      "Gracias por estar al día y por tu aporte al equipo.";

  }

}


document.getElementById(
  "playerPending"
).textContent =
  pending.length;

   await loadPlayerMatches();

renderPlayerCharges(
  currentCharges
);

renderPlayerPayments(
  payments
);

 loadTeamPosts();
    
    document.getElementById(
      "paymentDate"
    ).value =
      new Date()
        .toISOString()
        .split("T")[0];

  }


  /* =====================================================
     CARGOS DEL JUGADOR
  ===================================================== */
/* =====================================================
   PARTIDOS DEL JUGADOR
===================================================== */
async function loadPlayerMatches() {

  const container =
    document.getElementById("playerMatches");

  if (!container) return;

  container.innerHTML =
    "Cargando...";


  if (!currentPlayer) {

    container.innerHTML =
      `<p class="muted">
        No encontramos tu jugador.
      </p>`;

    return;

  }


  const today =
    new Date()
      .toISOString()
      .split("T")[0];


  const {
    data: matches,
    error
  } = await client
    .from("matches")
    .select("*")
    .eq("team_id", currentPlayer.team_id)
    .not("published_at", "is", null)
    .gte("match_date", today)
    .order("match_date", {
      ascending: true
    })
    .order("match_time", {
      ascending: true
    });


  if (error) {

    container.innerHTML =
      `<p class="muted">
        No pudimos cargar los próximos partidos.
      </p>`;

    showPlayerError(
      "No pudimos cargar los partidos: " +
      error.message
    );

    return;

  }


  if (!matches || !matches.length) {

    container.innerHTML =
      `<p class="muted">
        No hay próximos partidos publicados.
      </p>`;

    return;

  }


  const visibleMatches =
    matches.slice(0, 5);


  const renderMatches = (items) => {

    container.innerHTML =
      items.map(match => `

        <div
          class="payment"
          style="margin-bottom:12px;"
        >

          <strong>
            ⚽ ${escapeHtml(
              match.opponent ||
              "Partido"
            )}
          </strong>


          <p style="margin:6px 0;">

            📅 ${formatDate(
              match.match_date
            )}

            ${
              match.match_time
                ? `
                  · ⏰ ${
                    escapeHtml(
                      match.match_time
                        .substring(0, 5)
                    )
                  }
                `
                : ""
            }

          </p>


          <p
            class="muted"
            style="margin:4px 0;"
          >
            📍 ${
              escapeHtml(
                match.venue ||
                "Lugar a confirmar"
              )
            }
          </p>


          <p
            class="muted"
            style="margin:4px 0;"
          >
            💰 ${money(
              match.fee_per_player
            )}
          </p>


          ${
            match.notes
              ? `
                <p
                  class="muted"
                  style="margin:4px 0;"
                >
                  📝 ${
                    escapeHtml(
                      match.notes
                    )
                  }
                </p>
              `
              : ""
          }

        </div>

      `).join("");

  };


  renderMatches(visibleMatches);


  if (matches.length > 5) {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "btn-secondary player-matches-toggle";

    button.style.marginTop =
      "15px";

    button.textContent =
      `Ver todos los partidos (${matches.length})`;


    let showingAll = false;


    button.onclick = () => {

      showingAll =
        !showingAll;


      if (showingAll) {

        renderMatches(matches);

        button.textContent =
          "Ocultar partidos";

      } else {

        renderMatches(
          visibleMatches
        );

        button.textContent =
          `Ver todos los partidos (${matches.length})`;

      }

    };


    container.appendChild(button);
  
  }

}


/* =====================================================
   ACTIVIDAD DEL EQUIPO
===================================================== */
async function toggleTeamPostLike(postId) {

  if (!currentPlayer) {
    alert("No encontramos tu jugador.");
    return;
  }

  // Verificar si ya existe el like
  const {
    data: existingLike,
    error: checkError
  } = await client
    .from("team_post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("player_id", currentPlayer.id)
    .maybeSingle();

  if (checkError) {
    console.error("Error verificando like:", checkError);
    alert("No se pudo comprobar el Me gusta.");
    return;
  }

  // Si ya dio like → quitarlo
  if (existingLike) {

    const { error } = await client
      .from("team_post_likes")
      .delete()
      .eq("id", existingLike.id);

    if (error) {
      console.error("Error quitando like:", error);
      alert("No se pudo quitar el Me gusta.");
      return;
    }

  }

  // Si todavía no dio like → agregarlo
  else {

    const { error } = await client
      .from("team_post_likes")
      .insert({
        post_id: postId,
        player_id: currentPlayer.id
      });

    if (error) {
      console.error("Error agregando like:", error);
      alert("No se pudo agregar el Me gusta.");
      return;
    }

  }

  // Volver a cargar la actividad
  await loadTeamPosts();
}

async function loadTeamPosts() {

  const container =
    document.getElementById("teamPosts");

  if (!container) return;

  container.innerHTML =
    "Cargando...";


  if (!currentPlayer) {

    container.innerHTML =
      `<p class="muted">
        No encontramos tu jugador.
      </p>`;

    return;

  }


  const {
    data: posts,
    error
  } = await client
    .from("team_posts")
    .select(`
      *,
      players (
        name,
        nickname
      )
    `)
    .eq(
      "team_id",
      currentPlayer.team_id
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    console.error(
      "Error cargando actividad:",
      error
    );

    container.innerHTML =
      `<p class="muted">
        No pudimos cargar la actividad del equipo.
      </p>`;

    return;

  }


  if (!posts || !posts.length) {

    container.innerHTML =
      `<p class="muted">
        Todavía no hay aportes ni compromisos.
      </p>`;

    return;

  }

const {
  data: likes,
  error: likesError
} = await client
  .from("team_post_likes")
  .select("post_id, player_id")
  .in(
    "post_id",
    posts.map(post => post.id)
  );

if (likesError) {

  console.error(
    "Error cargando Me gusta:",
    likesError
  );

}
  const visiblePosts =
    posts.slice(0, 5);


  const renderPosts =
    (items) => {

      container.innerHTML = "";


      items.forEach(post => {

        const playerName =
          post.players?.nickname ||
          post.players?.name ||
          "Jugador";


        let icon =
          "🤝";

        if (
          post.post_type ===
          "money"
        ) {
          icon = "💰";
        }

        if (
          post.post_type ===
          "product"
        ) {
          icon = "🥩";
        }

        if (
          post.post_type ===
          "service"
        ) {
          icon = "🛠️";
        }


        let statusText =
          "Pendiente";

        let statusClass =
          "status-pending";


        if (
          post.status ===
          "confirmed"
        ) {

          statusText =
            "Confirmado";

          statusClass =
            "status-approved";

        }


        if (
          post.status ===
          "cancelled"
        ) {

          statusText =
            "Cancelado";

          statusClass =
            "status-rejected";

        }


        const div =
          document.createElement(
            "div"
          );

        div.className =
          "payment";

        div.style.marginBottom =
          "12px";


        div.innerHTML = `

          <strong>
            ${icon}
            ${escapeHtml(
              playerName
            )}
          </strong>

          <p
            style="
              margin:6px 0;
            "
          >
            ${escapeHtml(
              post.description
            )}
          </p>

          ${
            post.amount
              ? `
                <p
                  style="
                    margin:4px 0;
                  "
                >
                  💵 ${money(
                    post.amount
                  )}
                </p>
              `
              : ""
          }

 <span
  class="status ${statusClass}"
>
  ${statusText}
</span>

<div style="margin-top:10px;">
  <button
    type="button"
    class="btn-secondary"
    onclick="toggleTeamPostLike('${post.id}')"
  >
    ❤️ Me gusta
  </button>
</div>
<div
  style="
    margin-top:10px;
    font-size:14px;
  "
>
  ❤️ ${
    likes
      ? likes.filter(
          like => like.post_id === post.id
        ).length
      : 0
  }
  Me gusta
</div>
          <p
            class="muted"
            style="
              margin:6px 0 0;
            "
          >
            ${formatDate(
              post.created_at
                ? post.created_at.substring(
                    0,
                    10
                  )
                : null
            )}
          </p>

        `;


        container.appendChild(
          div
        );

      });

    };


  renderPosts(
    visiblePosts
  );


  if (posts.length > 5) {

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "btn-secondary";

    button.style.marginTop =
      "3px";

    button.textContent =
      `Ver toda la actividad (${posts.length})`;


    let showingAll =
      false;


    button.onclick =
      () => {

        showingAll =
          !showingAll;


        if (showingAll) {

          renderPosts(
            posts
          );

          button.textContent =
            "Ocultar actividad";

        } else {

          renderPosts(
            visiblePosts
          );

          button.textContent =
            `Ver toda la actividad (${posts.length})`;

        }

      };


    container.appendChild(
      button
    );

  }

}

/* =====================================================
   CARGOS DEL JUGADOR
===================================================== */

function renderPlayerCharges(
  charges
) {

  const table =
    document.getElementById(
      "playerChargesTable"
    );

  table.innerHTML = "";


  if (!charges.length) {

    table.innerHTML =
      `<tr>
        <td colspan="3">
          No tenés cargos registrados.
        </td>
      </tr>`;

    return;

  }


  // Mostrar inicialmente los últimos 5 cargos
  const visibleCharges =
    charges.slice(0, 5);


  const renderRows =
    (items) => {

      table.innerHTML = "";

      items.forEach(charge => {

        const row =
          document.createElement("tr");


        row.innerHTML = `
          <td>
            ${escapeHtml(
              charge.description ||
              charge.charge_type
            )}
          </td>

          <td>
            ${money(charge.amount)}
          </td>

          <td>
            ${formatDate(
              charge.created_at
                ? charge.created_at.substring(0,10)
                : null
            )}
          </td>
        `;


        table.appendChild(row);

      });

    };


  renderRows(
    visibleCharges
  );


  // Si hay más de 5 cargos,
  // mostrar botón para ver todos.

  if (charges.length > 5) {

    const container =
      table.closest(
        ".card"
      );

    if (!container) return;


    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "btn-secondary player-charges-toggle";

    button.style.marginTop =
      "15px";

    button.textContent =
      `Ver todos los cargos (${charges.length})`;


    let showingAll =
      false;


    button.onclick =
      () => {

        showingAll =
          !showingAll;


        if (showingAll) {

          renderRows(
            charges
          );

          button.textContent =
            "Ocultar cargos";

        } else {

          renderRows(
            visibleCharges
          );

          button.textContent =
            `Ver todos los cargos (${charges.length})`;

        }

      };


    container.appendChild(
      button
    );

  }

}

  /* =====================================================
     PAGOS DEL JUGADOR
  ===================================================== */

  function renderPlayerPayments(
  payments
) {

  const container =
    document.getElementById(
      "playerPayments"
    );

  container.innerHTML = "";


  if (!payments.length) {

    container.innerHTML =
      `<p class="muted">
        Todavía no registraste ningún pago.
      </p>`;

    return;

  }


  // Mostrar inicialmente solamente los últimos 5 pagos
  const visiblePayments =
    payments.slice(0, 5);


  const renderPayments =
    (items) => {

      container.innerHTML = "";

      items.forEach(payment => {

        const div =
          document.createElement("div");

        div.className =
          "payment";


        let statusClass =
          "status-pending";

        let statusText =
          "Pendiente";


        if (
          payment.status ===
          "approved"
        ) {

          statusClass =
            "status-approved";

          statusText =
            "Aprobado";

        }


        if (
          payment.status ===
          "rejected"
        ) {

          statusClass =
            "status-rejected";

          statusText =
            "Rechazado";

        }


        div.innerHTML = `
          <strong>
            ${money(payment.amount)}
          </strong>

          <p>
            ${escapeHtml(
              payment.payment_method
            )}
            —
            ${formatDate(
              payment.payment_date
            )}
          </p>

          <span class="status ${statusClass}">
            ${statusText}
          </span>
        `;


        container.appendChild(div);

      });

    };


  renderPayments(
    visiblePayments
  );


  // Si hay más de 5 pagos,
  // mostrar botón para ver todos.

  if (payments.length > 5) {

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "btn-secondary player-payments-toggle";

    button.style.marginTop =
      "15px";

    button.textContent =
      `Ver todos los pagos (${payments.length})`;


    let showingAll =
      false;


    button.onclick =
      () => {

        showingAll =
          !showingAll;


        if (showingAll) {

          renderPayments(
            payments
          );

          button.textContent =
            "Ocultar pagos";

        } else {

          renderPayments(
            visiblePayments
          );

          button.textContent =
            `Ver todos los pagos (${payments.length})`;

        }

      };


    container.appendChild(
      button
    );

  }

}
  /* =====================================================
     REGISTRAR PAGO
  ===================================================== */

  async function registerPayment() {

    if (!currentPlayer) {

      showPlayerError(
        "No encontramos tu jugador."
      );

      return;

    }


    const amount =
      Number(
        document.getElementById(
          "paymentAmount"
        ).value
      );


    const method =
      document.getElementById(
        "paymentMethod"
      ).value;


    const date =
      document.getElementById(
        "paymentDate"
      ).value;


    const file =
      document.getElementById(
        "paymentReceipt"
      ).files[0];


    if (!amount || amount <= 0) {

      showPlayerError(
        "Ingresá un monto válido."
      );

      return;

    }


    if (!date) {

      showPlayerError(
        "Seleccioná la fecha del pago."
      );

      return;

    }


   if (!file && method !== "cash") {

  showPlayerError(
    "Adjuntá el comprobante."
  );

  return;

}

    hidePlayerMessages();


    /*
      Cada comprobante queda dentro
      de la carpeta del usuario.
    */

   let fileName = null;

if (file) {

  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();

  fileName =
    currentUser.id +
    "/" +
    crypto.randomUUID() +
    "." +
    extension;


  const {
    error: uploadError
  } =
    await client
      .storage
      .from("comprobantes")
      .upload(
        fileName,
        file,
        {
          upsert: false
        }
      );


  if (uploadError) {

    showPlayerError(
      uploadError.message
    );

    return;

  }

}
    const {
      error: paymentError
    } =
      await client
        .from("payments")
        .insert({
          player_id:
            currentPlayer.id,

          team_id:
            currentPlayer.team_id,

          amount:
            amount,

          payment_method:
            method,

          payment_date:
            date,

          status:
            "pending",

          receipt_url:
            fileName
        });


    if (paymentError) {

      /*
        Si falla el registro del pago,
        intentamos eliminar el archivo.
      */

      await client
        .storage
        .from("comprobantes")
        .remove([
          fileName
        ]);


      showPlayerError(
        paymentError.message
      );

      return;

    }


    document.getElementById(
      "paymentAmount"
    ).value = "";


    document.getElementById(
      "paymentReceipt"
    ).value = "";


    showPlayerSuccess(
      "Pago registrado. Quedó pendiente de aprobación."
    );


    await loadPlayerDashboard(
      currentPlayer.id
    );

  }


  /* =====================================================
     LOGOUT
  ===================================================== */

  async function logout() {

    await client.auth.signOut();

    currentUser = null;
    currentPlayer = null;

    showLogin();

  }


  /* =====================================================
     MOSTRAR LOGIN
  ===================================================== */

  function showLogin() {

    loginPage.classList.remove("hidden");

    registerPage.classList.add("hidden");
    passwordRecoveryPage.classList.add("hidden");
    passwordResetPage.classList.add("hidden");
    onboardingPage.classList.add("hidden");
    adminPage.classList.add("hidden");
    playerPage.classList.add("hidden");

  }


  function showRegister() {

    loginPage.classList.add("hidden");
    registerPage.classList.remove("hidden");
    passwordRecoveryPage.classList.add("hidden");
    passwordResetPage.classList.add("hidden");
    onboardingPage.classList.add("hidden");
    adminPage.classList.add("hidden");
    playerPage.classList.add("hidden");

    hideRegisterMessages();

  }


  function showOnboarding() {

    loginPage.classList.add("hidden");
    registerPage.classList.add("hidden");
    passwordRecoveryPage.classList.add("hidden");
    passwordResetPage.classList.add("hidden");
    adminPage.classList.add("hidden");
    playerPage.classList.add("hidden");
    onboardingPage.classList.remove("hidden");

    const source = document.getElementById("newTeamSport");
    const target = document.getElementById("firstTeamSport");

    if (source && target && !target.options.length) {
      target.innerHTML = source.innerHTML;
      target.value = "Fútbol";
    }

    document.getElementById("onboardingError").classList.add("hidden");

    setTimeout(() => {
      document.getElementById("firstTeamName")?.focus();
    }, 0);

  }


  function showRegisterError(message) {

    const box =
      document.getElementById("registerError");

    box.textContent = message;
    box.classList.remove("hidden");

  }


  function showRegisterSuccess(message) {

    const box =
      document.getElementById("registerSuccess");

    box.textContent = message;
    box.classList.remove("hidden");

  }


  function hideRegisterMessages() {

    document.getElementById("registerError")
      .classList.add("hidden");

    document.getElementById("registerSuccess")
      .classList.add("hidden");

  }


  /* =====================================================
     MENSAJES LOGIN
  ===================================================== */

  function showLoginError(
    message
  ) {

    const box =
      document.getElementById(
        "loginError"
      );

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );

  }


  function hideLoginError() {

    document.getElementById(
      "loginError"
    ).classList.add(
      "hidden"
    );

  }


  /* =====================================================
     MENSAJES ADMIN
  ===================================================== */

  function showAdminError(
    message
  ) {

    const box =
      document.getElementById(
        "adminError"
      );

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );

  }


  function showAdminSuccess(
    message
  ) {

    const box =
      document.getElementById(
        "adminSuccess"
      );

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );

  }


  function hideAdminMessages() {

    document.getElementById(
      "adminError"
    ).classList.add(
      "hidden"
    );

    document.getElementById(
      "adminSuccess"
    ).classList.add(
      "hidden"
    );

  }


  /* =====================================================
     MENSAJES JUGADOR
  ===================================================== */

  function showPlayerError(
    message
  ) {

    const box =
      document.getElementById(
        "playerError"
      );

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );

  }


  function showPlayerSuccess(
    message
  ) {

    const box =
      document.getElementById(
        "playerSuccess"
      );

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );

  }


  function hidePlayerMessages() {

    document.getElementById(
      "playerError"
    ).classList.add(
      "hidden"
    );

    document.getElementById(
      "playerSuccess"
    ).classList.add(
      "hidden"
    );

  }


  /* =====================================================
     SEGURIDAD HTML
  ===================================================== */

  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  /* =====================================================
     RECUPERACIÓN DE CONTRASEÑA
  ===================================================== */

  function showPasswordRecovery() {

    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("passwordRecoveryPage").classList.remove("hidden");
    document.getElementById("passwordResetPage").classList.add("hidden");
    document.getElementById("onboardingPage").classList.add("hidden");

    document.getElementById("recoveryEmail").value = "";
    document.getElementById("recoveryError").classList.add("hidden");
    document.getElementById("recoverySuccess").classList.add("hidden");

  }


  async function sendPasswordRecovery() {

    const email = document
      .getElementById("recoveryEmail")
      .value
      .trim();

    const errorBox = document.getElementById("recoveryError");
    const successBox = document.getElementById("recoverySuccess");

    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");

    if (!email) {
      errorBox.textContent = "Ingresá tu email.";
      errorBox.classList.remove("hidden");
      return;
    }

    const { error } = await client.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: window.location.origin
      }
    );

    if (error) {
      errorBox.textContent =
        "No se pudo enviar el enlace: " + error.message;
      errorBox.classList.remove("hidden");
      return;
    }

    successBox.textContent =
      "Te enviamos un enlace para restablecer tu contraseña. Revisá tu correo.";
    successBox.classList.remove("hidden");

  }


  function showPasswordReset() {

    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("passwordRecoveryPage").classList.add("hidden");
    document.getElementById("passwordResetPage").classList.remove("hidden");
    document.getElementById("onboardingPage").classList.add("hidden");

    document.getElementById("resetError").classList.add("hidden");
    document.getElementById("resetSuccess").classList.add("hidden");

  }


  async function updatePassword() {

    const password =
      document.getElementById("newPassword").value;

    const confirmation =
      document.getElementById("newPasswordConfirm").value;

    const errorBox =
      document.getElementById("resetError");

    const successBox =
      document.getElementById("resetSuccess");

    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");

    if (password.length < 6) {
      errorBox.textContent =
        "La contraseña debe tener al menos 6 caracteres.";
      errorBox.classList.remove("hidden");
      return;
    }

    if (password !== confirmation) {
      errorBox.textContent =
        "Las contraseñas no coinciden.";
      errorBox.classList.remove("hidden");
      return;
    }

    const { error } =
      await client.auth.updateUser({
        password: password
      });

    if (error) {
      errorBox.textContent =
        "No se pudo cambiar la contraseña: " + error.message;
      errorBox.classList.remove("hidden");
      return;
    }

    successBox.textContent =
      "Contraseña actualizada correctamente.";

    successBox.classList.remove("hidden");

    setTimeout(() => {
      client.auth.signOut();
      showLogin();
    }, 1500);

  }


  /* =====================================================
     SESIÓN EXISTENTE
  ===================================================== */

  async function checkExistingSession() {

    const {
      data: {
        session
      }
    } =
      await client.auth.getSession();


    if (session) {

      await loadApplication();

    } else {

      showLogin();

    }

  }


  client.auth.onAuthStateChange((event) => {

    if (event === "PASSWORD_RECOVERY") {
      showPasswordReset();
    }

  });


  checkExistingSession();

function openTeamPostModal() {
  const modal = document.getElementById("teamPostModal");

  if (!modal) return;

  modal.style.display = "block";

  updateTeamPostForm();
}


function closeTeamPostModal() {
  const modal = document.getElementById("teamPostModal");

  if (!modal) return;

  modal.style.display = "none";
}


function updateTeamPostForm() {
  const type =
    document.getElementById("teamPostType")?.value;

  const amountContainer =
    document.getElementById("teamPostAmountContainer");

  const dateContainer =
    document.getElementById("teamPostDateContainer");

  if (!amountContainer || !dateContainer) return;

  if (type === "money") {
    amountContainer.style.display = "block";
    dateContainer.style.display = "none";
  } else if (type === "commitment") {
    amountContainer.style.display = "none";
    dateContainer.style.display = "block";
  } else {
    amountContainer.style.display = "none";
    dateContainer.style.display = "none";
  }
}


function clearTeamPostForm() {
  const description =
    document.getElementById("teamPostDescription");

  const amount =
    document.getElementById("teamPostAmount");

  const date =
    document.getElementById("teamPostDate");

  if (description) description.value = "";
  if (amount) amount.value = "";
  if (date) date.value = "";

  const type =
    document.getElementById("teamPostType");

  if (type) {
    type.value = "money";
  }

  updateTeamPostForm();
}
async function saveTeamPost() {

  const type =
    document.getElementById("teamPostType")?.value;

  const description =
    document.getElementById("teamPostDescription")?.value.trim();

  const amount =
    document.getElementById("teamPostAmount")?.value;

  const date =
    document.getElementById("teamPostDate")?.value;

  if (!currentPlayer) {
    alert("No encontramos tu jugador.");
    return;
  }

  if (!description) {
    alert("Escribí qué aportás o a qué te comprometés.");
    return;
  }

  if (type === "money" && (!amount || Number(amount) <= 0)) {
    alert("Ingresá el monto del aporte.");
    return;
  }

  const postData = {
    team_id: currentPlayer.team_id,
    player_id: currentPlayer.id,
    post_type: type,
    description: description,
    amount:
      type === "money"
        ? Number(amount)
        : null,
    status: "pending"
  };

  const { error } =
    await client
      .from("team_posts")
      .insert(postData);

  if (error) {
    console.error(
      "Error guardando aporte:",
      error
    );

    alert(
      "No se pudo guardar el aporte:\n" +
      error.message
    );

    return;
  }

  alert("✅ Aporte registrado correctamente.");

  clearTeamPostForm();

  closeTeamPostModal();

  await loadTeamPosts();
}

async function loadAdminTeamPosts() {

  const container =
    document.getElementById("adminTeamPosts");

  if (!container) return;

  if (!currentTeam) {
    container.innerHTML =
      `<p class="muted">
        No hay un equipo seleccionado.
      </p>`;
    return;
  }

  container.innerHTML = "Cargando...";

  const {
    data: posts,
    error
  } = await client
    .from("team_posts")
    .select(`
      *,
      players (
        name,
        nickname
      )
    `)
    .eq(
      "team_id",
      currentTeam.id
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );

  if (error) {

    console.error(
      "Error cargando aportes:",
      error
    );

    container.innerHTML =
      `<p class="muted">
        No pudimos cargar los aportes.
      </p>`;

    return;
  }

  if (!posts || !posts.length) {

    container.innerHTML =
      `<p class="muted">
        No hay aportes ni compromisos registrados.
      </p>`;

    return;
  }

  const visiblePosts =
    posts.slice(0, 5);

  const renderPosts =
    (items) => {

      container.innerHTML = "";

      items.forEach(post => {

        const playerName =
          post.players?.nickname ||
          post.players?.name ||
          "Jugador";

        let icon = "🤝";

        if (post.post_type === "money") {
          icon = "💰";
        }

        if (post.post_type === "product") {
          icon = "🥩";
        }

        if (post.post_type === "service") {
          icon = "🛠️";
        }

        let statusText = "Pendiente";
        let statusClass = "status-pending";

        if (post.status === "confirmed") {
          statusText = "Confirmado";
          statusClass = "status-approved";
        }

        if (post.status === "cancelled") {
          statusText = "Cancelado";
          statusClass = "status-rejected";
        }

        const div =
          document.createElement("div");

        div.className = "payment";

        div.style.marginBottom = "12px";

        div.innerHTML = `
          <strong>
            ${icon}
            ${escapeHtml(playerName)}
          </strong>

          <p style="margin:6px 0;">
            ${escapeHtml(post.description)}
          </p>

          ${
            post.amount
              ? `
                <p style="margin:4px 0;">
                  💵 ${money(post.amount)}
                </p>
              `
              : ""
          }

          <span class="status ${statusClass}">
            ${statusText}
          </span>
          
${
  post.status === "pending"
    ? `
      <div
        style="
          display:flex;
          gap:8px;
          margin-top:10px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="btn-primary"
          onclick="confirmTeamPost('${post.id}')"
        >
          ✅ Confirmar
        </button>

        <button
          type="button"
          class="btn-danger"
          onclick="cancelTeamPost('${post.id}')"
        >
          ❌ Cancelar
        </button>

      </div>
    `
    : ""
}

          <p
            class="muted"
            style="margin:6px 0 0;"
          >
            ${formatDate(
              post.created_at
                ? post.created_at.substring(0, 10)
                : null
            )}
          </p>
        `;

        container.appendChild(div);

      });

    };

  renderPosts(visiblePosts);

  if (posts.length > 5) {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "btn-secondary";

    button.style.marginTop = "3px";

    button.textContent =
      `Ver todos los aportes (${posts.length})`;

    let showingAll = false;

    button.onclick = () => {

      showingAll = !showingAll;

      if (showingAll) {

        renderPosts(posts);

        button.textContent =
          "Ocultar aportes";

      } else {

        renderPosts(visiblePosts);

        button.textContent =
          `Ver todos los aportes (${posts.length})`;

      }

      container.appendChild(button);

    };

    container.appendChild(button);

  }

}

async function confirmTeamPost(postId) {

  const confirmed = confirm(
    "¿Querés confirmar este aporte o compromiso?"
  );

  if (!confirmed) return;

  const { error } =
    await client
      .from("team_posts")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString()
      })
      .eq("id", postId)
      .eq("team_id", currentTeam.id);

  if (error) {

    console.error(
      "Error confirmando aporte:",
      error
    );

    showAdminError(
      "No se pudo confirmar el aporte: " +
      error.message
    );

    return;
  }

  showAdminSuccess(
    "Aporte confirmado correctamente."
  );

  await loadAdminTeamPosts();
}


async function cancelTeamPost(postId) {

  const confirmed = confirm(
    "¿Querés cancelar este aporte o compromiso?"
  );

  if (!confirmed) return;

  const { error } =
    await client
      .from("team_posts")
      .update({
        status: "cancelled"
      })
      .eq("id", postId)
      .eq("team_id", currentTeam.id);

  if (error) {

    console.error(
      "Error cancelando aporte:",
      error
    );

    showAdminError(
      "No se pudo cancelar el aporte: " +
      error.message
    );

    return;
  }

  showAdminSuccess(
    "Aporte cancelado correctamente."
  );

  await loadAdminTeamPosts();
}

function openInvitePlayerModal() {
  const modal = document.getElementById("invitePlayerModal");

  if (!modal) return;

  const nameInput = document.getElementById("invitePlayerName");
  const emailInput = document.getElementById("invitePlayerEmail");

  if (nameInput) nameInput.value = "";
  if (emailInput) emailInput.value = "";

  modal.style.display = "flex";

  if (nameInput) {
    nameInput.focus();
  }
}


function closeInvitePlayerModal() {
  const modal = document.getElementById("invitePlayerModal");

  if (!modal) return;

  modal.style.display = "none";
}

async function sendPlayerInvitation() {

  const name =
    document.getElementById("invitePlayerName")?.value.trim();

  const email =
    document.getElementById("invitePlayerEmail")?.value.trim().toLowerCase();

  if (!currentTeam) {
    alert("No hay un equipo seleccionado.");
    return;
  }

  if (!name) {
    alert("Ingresá el nombre del jugador.");
    return;
  }

  if (!email) {
    alert("Ingresá el email del jugador.");
    return;
  }

  const { error } = await client
    .from("team_invitations")
   .insert({
  team_id: currentTeam.id,
  name: name,
  email: email,
  status: "pending"
});
  if (error) {
    console.error("Error creando invitación:", error);
    alert("No se pudo crear la invitación: " + error.message);
    return;
  }

  alert("✅ Invitación creada correctamente.");

  closeInvitePlayerModal();
}
