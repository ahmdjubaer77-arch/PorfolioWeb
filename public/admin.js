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
const messagesPanel = document.querySelector("#messages-panel");
const messagesList = document.querySelector("#messages-list");
const messagesFeedback = document.querySelector("#messages-feedback");
const messagesLoading = document.querySelector("#messages-loading");
const messagesEmpty = document.querySelector("#messages-empty");
const messagesPagination = document.querySelector("#message-pagination");
const messageDialog = document.querySelector("#message-dialog");
const adminToast = document.querySelector("#admin-toast");
const list = document.querySelector("#item-list");
const form = document.querySelector("#entry-form");
const editPanel = document.querySelector("#edit-panel");
let activeSection = "overview";
let editingId = null;
let messageItems = [];
let messageFilter = "all";
let messagePage = 1;
let selectedMessage = null;
let toastTimeout = null;
const messagesPerPage = 8;

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
    const isMessages = section === "messages";
    document.querySelectorAll(".nav-item").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.section === section);
    });
    document.querySelector("#page-title").textContent = isOverview ? "Overview" : isAccount ? "Account & Security" : isMessages ? "Messages" : titles[section];
    overview.hidden = !isOverview;
    manager.hidden = isOverview || isAccount || isMessages;
    accountPanel.hidden = !isAccount;
    messagesPanel.hidden = !isMessages;
    editPanel.hidden = true;
    if (isMessages) loadMessages();
    else if (!isOverview && !isAccount) loadItems();
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

function formatMessageDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function mailtoAddress(email) {
    return encodeURIComponent(email).replace(/%40/gi, "@");
}

function showAdminToast(message) {
    adminToast.textContent = message;
    adminToast.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => adminToast.classList.remove("is-visible"), 3200);
}

function updateMessageStats() {
    const unreadCount = messageItems.filter((item) => item.status === "unread").length;
    document.querySelector("#message-total").textContent = messageItems.length;
    document.querySelector("#message-unread").textContent = unreadCount;
    document.querySelector("#message-read").textContent = messageItems.length - unreadCount;
}

function filteredMessages() {
    const query = document.querySelector("#message-search").value.trim().toLowerCase();
    return messageItems.filter((item) => {
        const matchesStatus = messageFilter === "all" || item.status === messageFilter;
        const matchesSearch = !query || [item.name, item.email, item.subject]
            .some((value) => String(value || "").toLowerCase().includes(query));
        return matchesStatus && matchesSearch;
    });
}

function renderMessages() {
    updateMessageStats();
    const matchingItems = filteredMessages();
    const pageCount = Math.max(1, Math.ceil(matchingItems.length / messagesPerPage));
    messagePage = Math.min(messagePage, pageCount);
    const start = (messagePage - 1) * messagesPerPage;
    const pageItems = matchingItems.slice(start, start + messagesPerPage);
    messagesList.replaceChildren();

    pageItems.forEach((item) => {
        const card = document.createElement("article");
        card.className = `message-card${item.status === "unread" ? " is-unread" : ""}`;
        const open = document.createElement("button");
        open.type = "button";
        open.className = "message-card-button";

        const header = document.createElement("div");
        header.className = "message-card-header";
        const sender = document.createElement("div");
        sender.className = "message-card-sender";
        const name = document.createElement("strong");
        name.textContent = item.name;
        const email = document.createElement("span");
        email.textContent = item.email;
        sender.append(name, email);
        const status = document.createElement("span");
        status.className = `message-status ${item.status === "read" ? "is-read" : "is-unread"}`;
        status.textContent = item.status === "read" ? "Read" : "Unread";
        header.append(sender, status);

        const subject = document.createElement("h3");
        subject.textContent = item.subject;
        const preview = document.createElement("p");
        preview.className = "message-preview";
        preview.textContent = item.message;
        const date = document.createElement("time");
        date.className = "message-card-date";
        date.dateTime = item.createdAt || "";
        date.textContent = formatMessageDate(item.createdAt);
        open.append(header, subject, preview, date);
        open.addEventListener("click", () => openMessage(item));
        card.append(open);
        messagesList.append(card);
    });

    messagesEmpty.hidden = matchingItems.length > 0;
    if (messageItems.length === 0) messagesEmpty.textContent = "No messages yet. New contact messages will appear here.";
    else if (matchingItems.length === 0) messagesEmpty.textContent = "No messages match your search or filter.";
    messagesPagination.hidden = matchingItems.length <= messagesPerPage;
    document.querySelector("#messages-page-label").textContent = `Page ${messagePage} of ${pageCount}`;
    document.querySelector("#messages-previous").disabled = messagePage <= 1;
    document.querySelector("#messages-next").disabled = messagePage >= pageCount;
}

async function loadMessages() {
    messagesFeedback.textContent = "";
    messagesFeedback.classList.remove("is-error");
    messagesLoading.hidden = false;
    messagesEmpty.hidden = true;
    messagesPagination.hidden = true;
    messagesList.replaceChildren();
    try {
        const result = await request("/api/messages");
        messageItems = Array.isArray(result) ? result : [];
        messagePage = 1;
        renderMessages();
    } catch (error) {
        messagesFeedback.textContent = error.message;
        messagesFeedback.classList.add("is-error");
    } finally {
        messagesLoading.hidden = true;
    }
}

function renderMessageDetails(item) {
    selectedMessage = item;
    document.querySelector("#message-detail-subject").textContent = item.subject;
    document.querySelector("#message-detail-name").textContent = item.name;
    const email = document.querySelector("#message-detail-email");
    email.textContent = item.email;
    email.href = `mailto:${mailtoAddress(item.email)}`;
    const date = document.querySelector("#message-detail-date");
    date.dateTime = item.createdAt || "";
    date.textContent = formatMessageDate(item.createdAt);
    document.querySelector("#message-detail-body").textContent = item.message;
    const status = document.querySelector("#message-detail-status");
    status.textContent = item.status === "read" ? "Read" : "Unread";
    status.className = `message-status ${item.status === "read" ? "is-read" : "is-unread"}`;
    document.querySelector("#message-toggle-status").textContent = item.status === "read" ? "Mark as Unread" : "Mark as Read";
    document.querySelector("#message-reply").href = `mailto:${mailtoAddress(item.email)}?subject=${encodeURIComponent(`Re: ${item.subject}`)}`;
}

function openMessage(item) {
    renderMessageDetails(item);
    if (!messageDialog.open) messageDialog.showModal();
}

async function toggleMessageStatus() {
    if (!selectedMessage) return;
    const nextStatus = selectedMessage.status === "read" ? "unread" : "read";
    try {
        const updated = await request(`/api/messages/${encodeURIComponent(selectedMessage._id)}/read`, {
            method: "PATCH",
            body: JSON.stringify({ status: nextStatus })
        });
        messageItems = messageItems.map((item) => item._id === updated._id ? updated : item);
        renderMessageDetails(updated);
        renderMessages();
        showAdminToast(nextStatus === "read" ? "Message marked as read." : "Message marked as unread.");
    } catch (error) {
        messagesFeedback.textContent = error.message;
        messagesFeedback.classList.add("is-error");
    }
}

async function deleteSelectedMessage() {
    if (!selectedMessage || !window.confirm(`Delete the message from ${selectedMessage.name}? This cannot be undone.`)) return;
    try {
        await request(`/api/messages/${encodeURIComponent(selectedMessage._id)}`, { method: "DELETE" });
        messageItems = messageItems.filter((item) => item._id !== selectedMessage._id);
        messageDialog.close();
        selectedMessage = null;
        renderMessages();
        showAdminToast("Message deleted.");
    } catch (error) {
        messagesFeedback.textContent = error.message;
        messagesFeedback.classList.add("is-error");
    }
}

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
document.querySelector("#add-button").addEventListener("click", () => openForm());
document.querySelector("#cancel-button").addEventListener("click", closeForm);
document.querySelector("#refresh-messages").addEventListener("click", loadMessages);
document.querySelector("#message-search").addEventListener("input", () => {
    messagePage = 1;
    renderMessages();
});
document.querySelectorAll("[data-message-filter]").forEach((button) => button.addEventListener("click", () => {
    messageFilter = button.dataset.messageFilter;
    messagePage = 1;
    document.querySelectorAll("[data-message-filter]").forEach((filterButton) => {
        const isActive = filterButton === button;
        filterButton.classList.toggle("is-active", isActive);
        filterButton.setAttribute("aria-pressed", String(isActive));
    });
    renderMessages();
}));
document.querySelector("#messages-previous").addEventListener("click", () => {
    messagePage -= 1;
    renderMessages();
});
document.querySelector("#messages-next").addEventListener("click", () => {
    messagePage += 1;
    renderMessages();
});
document.querySelector("#message-detail-close").addEventListener("click", () => messageDialog.close());
document.querySelector("#message-toggle-status").addEventListener("click", toggleMessageStatus);
document.querySelector("#message-delete").addEventListener("click", deleteSelectedMessage);
messageDialog.addEventListener("click", (event) => {
    if (event.target === messageDialog) messageDialog.close();
});

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
