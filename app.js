
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
      SUPABASE_KEY
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

      // Usuario autenticado pero todavía sin equipo.
      // Mostrar el onboarding para que pueda crear su primer equipo.
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

    return "Único";
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


  container.innerHTML =
    matches.map(match => {

      const published =
        !!match.published_at;

      return `
        <div class="payment" style="margin-bottom:12px;">

          <div style="display:flex; justify-content:space-between; gap:15px; flex-wrap:wrap;">

            <div>

              <strong>
                ⚽ ${escapeHtml(
                  match.opponent ||
                  "Partido"
                )}
              </strong>

              <p style="margin:6px 0;">
                📅 ${formatDate(match.match_date)}
                ${match.match_time
                  ? ` · ⏰ ${escapeHtml(match.match_time.substring(0,5))}`
                  : ""
                }
              </p>

              <p class="muted" style="margin:4px 0;">
                📍 ${escapeHtml(
                  match.venue ||
                  "Lugar a confirmar"
                )}
              </p>

              <p class="muted" style="margin:4px 0;">
                💰 ${money(match.fee_per_player)}
              </p>

              ${
                match.notes
                  ? `
                    <p class="muted" style="margin:4px 0;">
                      📝 ${escapeHtml(match.notes)}
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

    }).join("");

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

    const { data: settings, error } = await client
      .from("team_settings")
      .select("*")
      .eq("team_id", currentTeam.id)
      .maybeSingle();

    if (error) {
      showAdminError("No pudimos cargar la configuración: " + error.message);
      return;
    }

    document.getElementById("teamRegistrationFee").value =
      settings ? Number(settings.registration_fee || 0) : 0;

    document.getElementById("teamMonthlyInsurance").value =
      settings ? Number(settings.monthly_insurance || 0) : 0;

    document.getElementById("teamMatchFee").value =
      settings ? Number(settings.match_fee || 0) : 0;
  }


  async function saveTeamSettings() {

    if (!currentTeam) {
      showAdminError("No hay un equipo seleccionado.");
      return;
    }

    const registrationFee = Number(document.getElementById("teamRegistrationFee").value);
    const monthlyInsurance = Number(document.getElementById("teamMonthlyInsurance").value);
    const matchFee = Number(document.getElementById("teamMatchFee").value);

    if (registrationFee < 0 || monthlyInsurance < 0 || matchFee < 0) {
      showAdminError("Los valores no pueden ser negativos.");
      return;
    }

    const { data: existing, error: existingError } = await client
      .from("team_settings")
      .select("id")
      .eq("team_id", currentTeam.id)
      .maybeSingle();

    if (existingError) {
      showAdminError("No pudimos comprobar la configuración: " + existingError.message);
      return;
    }

    let error;

    if (existing) {
      const result = await client
        .from("team_settings")
        .update({
          team_name: currentTeam.name,
          registration_fee: registrationFee,
          monthly_insurance: monthlyInsurance,
          match_fee: matchFee
        })
        .eq("id", existing.id)
        .eq("team_id", currentTeam.id);

      error = result.error;

    } else {
      const result = await client
        .from("team_settings")
        .insert({
          team_id: currentTeam.id,
          team_name: currentTeam.name,
          description: currentTeam.description || "",
          registration_fee: registrationFee,
          monthly_insurance: monthlyInsurance,
          match_fee: matchFee
        });

      error = result.error;
    }

    if (error) {
      showAdminError("No se pudieron guardar los cambios: " + error.message);
      return;
    }

    showAdminSuccess("Configuración guardada correctamente.");

    await loadAdminDashboard();
  }


  /* =====================================================
     ADMIN
  ===================================================== */

  async function loadAdminDashboard() {

    hideAdminMessages();

    await loadTeamSettings();
    await loadChargeConcepts();
    await loadMatches();


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

    const registrationTotal =
      currentRegistrationFee * players.length;


    const approvedPayments =
      payments.filter(
        p =>
          p.status ===
          "approved"
      );


    const approvedTotal =
      approvedPayments.reduce(
        (sum, p) =>
          sum + Number(p.amount),
        0
      );


    const pendingPayments =
      payments.filter(
        p =>
          p.status ===
          "pending"
      );

    const playerBalances = players.map(player => {
      const chargesTotal = charges
        .filter(c => c.player_id === player.id)
        .reduce((sum, c) => {
          const amount =
            c.charge_type === "registration"
              ? currentRegistrationFee
              : Number(c.amount || 0);
          return sum + amount;
        }, 0);

      const paidTotal = payments
        .filter(p => p.player_id === player.id && p.status === "approved")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return paidTotal - chargesTotal;
    });

    const totalCredits = playerBalances
      .filter(v => v > 0)
      .reduce((sum, v) => sum + v, 0);

    const totalDebts = playerBalances
      .filter(v => v < 0)
      .reduce((sum, v) => sum + Math.abs(v), 0);



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
      currentRegistrationFee
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

    const name = document.getElementById("newPlayerName").value.trim();
    const nickname = document.getElementById("newPlayerNickname").value.trim();
    const dni = document.getElementById("newPlayerDni").value.trim();
    if (!name) {
      showAdminError("Ingresá el nombre del jugador.");
      return;
    }

    const { count, error: countError } = await client
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("team_id", currentTeam.id)
      .eq("active", true);

    if (countError) {
      showAdminError("No pudimos comprobar la cantidad de jugadores: " + countError.message);
      return;
    }

    if ((count || 0) >= 50) {
      showAdminError("Este equipo ya alcanzó el máximo de 50 jugadores.");
      return;
    }

    const { error } = await client
      .from("players")
      .insert({
        team_id: currentTeam.id,
        name: name,
        nickname: nickname || null,
        dni: dni || null,
        active: true
      });

    if (error) {
      showAdminError("No se pudo agregar el jugador: " + error.message);
      return;
    }

    document.getElementById("newPlayerName").value = "";
    document.getElementById("newPlayerNickname").value = "";
    document.getElementById("newPlayerDni").value = "";
    document.getElementById("addPlayerForm").style.display = "none";

    showAdminSuccess("Jugador agregado correctamente.");
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
    currentRegistrationFee
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
          .reduce((sum, c) => {
            const amount =
              c.charge_type === "registration"
                ? currentRegistrationFee
                : Number(c.amount || 0);

            return sum + amount;
          }, 0);


      const playerPaid =
        payments
          .filter(
            p =>
              p.player_id ===
              player.id &&
              p.status ===
              "approved"
          )
          .reduce(
            (sum, p) =>
              sum + Number(p.amount),
            0
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


      row.innerHTML = `
  <td>
    ${escapeHtml(player.name)}
    ${player.nickname ? `<span class="muted"> (${escapeHtml(player.nickname)})</span>` : ""}
  </td>

  <td>
    ${escapeHtml(player.dni || "-")}
  </td>

  <td>${money(playerCharges)}</td>

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


    const totalCharges =
      charges.reduce((sum, c) => {
        const amount =
          c.charge_type === "registration"
            ? currentRegistrationFee
            : Number(c.amount || 0);

        return sum + amount;
      }, 0);


    const totalPaid =
      payments
        .filter(
          p =>
            p.status ===
            "approved"
        )
        .reduce(
          (sum, p) =>
            sum + Number(p.amount),
          0
        );


    const pending =
      payments.filter(
        p =>
          p.status ===
          "pending"
      );


    const debt =
      Math.max(
        0,
        totalCharges -
        totalPaid
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
      "playerCharges"
    ).textContent =
      money(totalCharges);


    document.getElementById(
      "playerPaid"
    ).textContent =
      money(totalPaid);


    document.getElementById(
      "playerDebt"
    ).textContent =
      money(Math.max(0, debt));


    const playerDifference =
      totalPaid - totalCharges;

    document.getElementById("playerCredit").textContent =
      money(Math.max(0, playerDifference));

    document.getElementById("playerDebtBox").textContent =
      money(Math.max(0, -playerDifference));


    document.getElementById(
      "playerPending"
    ).textContent =
      pending.length;

    await loadPlayerMatches();
    renderPlayerCharges(
      charges
    );

    await loadPlayerMatches();
    renderPlayerPayments(
      payments
    );


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
    matches.slice(0, 3);


  container.innerHTML =
    visibleMatches.map(match => `

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

}
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


    charges.forEach(charge => {

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


    payments.forEach(payment => {

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


    if (!file) {

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

    const extension =
      file.name
        .split(".")
        .pop()
        .toLowerCase();


    const fileName =
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
