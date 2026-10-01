const fields = {
    projects: [
        ["title", "Title", "text", true], ["description", "Description", "textarea"], ["category", "Category", "text"],
        ["technologies", "Technologies (comma-separated)", "list"], ["file", "Project image or PDF", "file"],
        ["githubUrl", "GitHub URL", "url"], ["liveUrl", "Live Demo URL", "url"], ["featured", "Featured", "checkbox"]
    ],
    achievements: [
        ["year", "Year", "text"], ["title", "Title", "text", true], ["organization", "Organization", "text"],
        ["award", "Award / Position", "text"], ["description", "Description", "textarea"], ["file", "Achievement image or PDF", "file"]
    ],
    blog: [
        ["title", "Title", "text", true], ["category", "Category", "text"], ["date", "Date", "date"],
        ["readingTime", "Reading time", "text"], ["excerpt", "Excerpt", "textarea"], ["content", "Content", "textarea"],
        ["file", "Cover image or PDF", "file"], ["tags", "Tags (comma-separated)", "list"], ["featured", "Featured", "checkbox"]
    ],
    reviews: [
        ["name", "Name", "text", true], ["role", "Role", "text"], ["organization", "Organization", "text"],
        ["text", "Review text", "textarea", true], ["rating", "Rating (1-5)", "number", true], ["file", "Profile image or PDF", "file"]
    ],
    skills: [
        ["name", "Name", "text", true], ["category", "Category", "text"], ["icon", "Icon class", "text"],
        ["description", "Description", "textarea"], ["level", "Skill level (0–100)", "number", true]
    ],
    experience: [
        ["position", "Position", "text", true], ["organization", "Organization", "text"],
        ["startDate", "Start date", "text"], ["endDate", "End date", "text"],
        ["description", "Description", "textarea"], ["technologies", "Technologies (comma-separated)", "list"]
    ]
};

const titles = { projects: "Projects", achievements: "Achievements", blog: "Blog Posts", reviews: "Reviews", skills: "Skills", experience: "Experience" };
const assetFields = { projects: "imageUrl", achievements: "imageUrl", blog: "coverImageUrl", reviews: "profileImageUrl" };
const overview = document.querySelector("#overview");
const manager = document.querySelector("#manager");
const accountPanel = document.querySelector("#account-panel");
const accountMessage = document.querySelector("#account-message");
const list = document.querySelector("#item-list");
const form = document.querySelector("#entry-form");
const editPanel = document.querySelector("#edit-panel");
let activeSection = "overview";
let editingId = null;

async function request(path, options = {}) {
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const response = await fetch(path, {
        ...options,
        headers
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "The request could not be completed.");
    return result;
}

function displayName(section, item) {
    return item.title || item.name || item.position || "Untitled entry";
}

async function loadOverview() {
    const counts = await Promise.all(Object.keys(fields).map(async (section) => {
        const items = await request(`/api/${section}`);
        return [section, items.length];
    }));
    const stats = document.querySelector("#stats-grid");
    stats.replaceChildren();
    counts.forEach(([section, count]) => {
        const card = document.createElement("article");
        card.className = "stat";
        const label = document.createElement("span");
        label.textContent = titles[section];
        const amount = document.createElement("strong");
        amount.textContent = count;
        card.append(label, amount);
        stats.append(card);
    });
}

function setSection(section) {
    activeSection = section;
    const isOverview = section === "overview";
    const isAccount = section === "account";
    document.querySelectorAll(".nav-item").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.section === section);
    });
    document.querySelector("#page-title").textContent = isOverview ? "Overview" : isAccount ? "Account & Security" : titles[section];
    overview.hidden = !isOverview;
    manager.hidden = isOverview || isAccount;
    accountPanel.hidden = !isAccount;
    editPanel.hidden = true;
    if (!isOverview && !isAccount) loadItems();
}

async function loadItems() {
    const message = document.querySelector("#message");
    message.textContent = "";
    list.replaceChildren();
    try {
        const items = await request(`/api/${activeSection}`);
        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = `No ${titles[activeSection].toLowerCase()} yet. Add the first entry to get started.`;
            list.append(empty);
            return;
        }
        items.forEach((item) => {
            const row = document.createElement("article");
            row.className = "item-row";
            const copy = document.createElement("div");
            copy.className = "item-copy";
            const name = document.createElement("strong");
            name.textContent = displayName(activeSection, item);
            const detail = document.createElement("span");
            detail.textContent = item.category || item.organization || item.year || item.position || item.date || "";
            copy.append(name, detail);
            const actions = document.createElement("div");
            actions.className = "item-actions";
            const edit = document.createElement("button");
            edit.type = "button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => openForm(item));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "delete-button";
            remove.textContent = "Delete";
            remove.addEventListener("click", () => deleteItem(item));
            actions.append(edit, remove);
            row.append(copy, actions);
            list.append(row);
        });
    } catch (error) {
        message.textContent = error.message;
    }
}

function openForm(item = null) {
    editingId = item?._id || null;
    form.replaceChildren();
    document.querySelector("#form-title").textContent = `${editingId ? "Edit" : "Add"} ${titles[activeSection].replace(/s$/, "")}`;

    fields[activeSection].forEach(([name, labelText, type, required]) => {
        const label = document.createElement("label");
        label.className = "field";
        label.classList.toggle("field-wide", type === "textarea" || type === "file" || type === "list");
        const caption = document.createElement("span");
        caption.textContent = labelText;
        const input = document.createElement(type === "textarea" ? "textarea" : "input");
        input.name = name;
        input.required = Boolean(required);

        if (type === "checkbox") {
            input.type = "checkbox";
            input.checked = Boolean(item?.[name]);
        } else {
            input.type = type === "list" ? "text" : type === "file" ? "file" : type;
            if (type === "file") {
                input.accept = ".jpg,.jpeg,.png,.pdf";
                input.addEventListener("change", () => previewFile(input));
            }
            if (type === "number" && name === "rating") {
                input.min = "1";
                input.max = "5";
            } else if (type === "number") {
                input.min = "0";
                input.max = "100";
            }
            const value = item?.[name];
            if (type !== "file") input.value = Array.isArray(value) ? value.join(", ") : value || "";
        }
        label.append(caption, input);

        if (type === "file") {
            const preview = document.createElement("div");
            preview.className = "file-preview";
            label.append(preview);
            const currentPath = item?.[assetFields[activeSection]];
            if (currentPath) showFilePreview(preview, currentPath, currentPath.split("/").pop());
        }
        form.append(label);
    });

    const actions = document.createElement("div");
    actions.className = "form-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", closeForm);
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "primary-button";
    save.textContent = editingId ? "Save changes" : "Add entry";
    actions.append(cancel, save);
    form.append(actions);
    editPanel.hidden = false;
    editPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showFilePreview(preview, source, name) {
    preview.replaceChildren();
    if (/\.pdf$/i.test(name)) {
        const link = document.createElement("a");
        link.href = source;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `Open PDF: ${name}`;
        preview.append(link);
        return;
    }

    const image = document.createElement("img");
    image.className = "image-preview";
    image.alt = "Uploaded image preview";
    image.src = source;
    preview.append(image);
}

function previewFile(input) {
    const preview = input.parentElement.querySelector(".file-preview");
    const file = input.files[0];
    preview.replaceChildren();
    if (!file) return;

    const source = URL.createObjectURL(file);
    form.dataset.previewUrl = source;
    showFilePreview(preview, source, file.name);
}

function closeForm() {
    if (form.dataset.previewUrl) URL.revokeObjectURL(form.dataset.previewUrl);
    delete form.dataset.previewUrl;
    editingId = null;
    editPanel.hidden = true;
    form.reset();
}

async function deleteItem(item) {
    if (!window.confirm(`Delete "${displayName(activeSection, item)}"? This cannot be undone.`)) return;
    try {
        await request(`/api/${activeSection}/${item._id}`, { method: "DELETE" });
        await loadItems();
    } catch (error) {
        document.querySelector("#message").textContent = error.message;
    }
}

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
document.querySelector("#add-button").addEventListener("click", () => openForm());
document.querySelector("#cancel-button").addEventListener("click", closeForm);

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = {};
    fields[activeSection].forEach(([name, , type]) => {
        if (type === "file") return;
        const input = form.elements.namedItem(name);
        if (type === "checkbox") values[name] = input.checked;
        else if (type === "list") values[name] = input.value.split(",").map((value) => value.trim()).filter(Boolean);
        else if (type === "number") values[name] = Number(input.value);
        else values[name] = input.value.trim();
    });

    try {
        const method = editingId ? "PUT" : "POST";
        const path = `/api/${activeSection}${editingId ? `/${editingId}` : ""}`;
        const body = new FormData();
        body.append("record", JSON.stringify(values));
        const fileInput = form.elements.namedItem("file");
        if (fileInput?.files[0]) body.append("file", fileInput.files[0]);
        await request(path, { method, body });
        closeForm();
        await loadItems();
    } catch (error) {
        document.querySelector("#message").textContent = error.message;
    }
});

document.querySelector("#username-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const usernameForm = event.currentTarget;
    const values = Object.fromEntries(new FormData(usernameForm));

    try {
        const result = await request("/admin/account/username", {
            method: "POST",
            body: JSON.stringify(values)
        });
        usernameForm.elements.namedItem("username").value = result.username;
        usernameForm.elements.namedItem("currentPassword").value = "";
        accountMessage.textContent = result.message;
        accountMessage.classList.remove("is-error");
    } catch (error) {
        accountMessage.textContent = error.message;
        accountMessage.classList.add("is-error");
    }
});

document.querySelector("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const passwordForm = event.currentTarget;
    const values = Object.fromEntries(new FormData(passwordForm));

    try {
        const result = await request("/admin/account/password", {
            method: "POST",
            body: JSON.stringify(values)
        });
        accountMessage.textContent = result.message;
        accountMessage.classList.remove("is-error");
        window.location.assign(result.redirect || "/admin/login");
    } catch (error) {
        accountMessage.textContent = error.message;
        accountMessage.classList.add("is-error");
    }
});

loadOverview().catch((error) => {
    document.querySelector("#stats-grid").textContent = error.message;
});
