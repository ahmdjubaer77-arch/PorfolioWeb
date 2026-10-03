const navigation = document.querySelector(".navbar");
const topNavigationLinks = [...document.querySelectorAll(".navbar .nav-link")];
const floatingNavigationLinks = [...document.querySelectorAll(".floating-nav-link")];
const navigationLinks = [...topNavigationLinks, ...floatingNavigationLinks];
const glassDrop = document.querySelector(".glass-drop");
const themeToggles = [...document.querySelectorAll("[data-theme-toggle]")];
const navigationSections = [...document.querySelectorAll("header[id], main section[id]")];

if (themeToggles.length > 0) {
    const systemThemePreference = window.matchMedia("(prefers-color-scheme: light)");
    let hasSavedTheme = false;
    let themeTransitionTimer;

    try {
        hasSavedTheme = localStorage.getItem("portfolio-theme") === "light" || localStorage.getItem("portfolio-theme") === "dark";
    } catch {
        hasSavedTheme = false;
    }

    function setTheme(theme, savePreference = false, animate = false) {
        const isLightTheme = theme === "light";

        if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            window.clearTimeout(themeTransitionTimer);
            document.documentElement.classList.add("theme-transition");
            themeTransitionTimer = window.setTimeout(() => {
                document.documentElement.classList.remove("theme-transition");
            }, 320);
        }

        document.documentElement.dataset.theme = isLightTheme ? "light" : "dark";
        themeToggles.forEach((themeToggle) => {
            themeToggle.setAttribute("aria-pressed", String(isLightTheme));
            themeToggle.setAttribute("aria-label", `Switch to ${isLightTheme ? "Dark" : "Light"} Mode`);
            themeToggle.title = `Switch to ${isLightTheme ? "Dark" : "Light"} Mode`;
        });

        if (savePreference) {
            try {
                localStorage.setItem("portfolio-theme", isLightTheme ? "light" : "dark");
                hasSavedTheme = true;
            } catch {
                hasSavedTheme = false;
            }
        }
    }

    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");

    themeToggles.forEach((themeToggle) => {
        themeToggle.addEventListener("click", () => {
            const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
            setTheme(nextTheme, true, true);
        });
    });

    systemThemePreference.addEventListener("change", (event) => {
        if (!hasSavedTheme) setTheme(event.matches ? "light" : "dark", false, true);
    });
}

const floatingNavigation = document.querySelector("[data-floating-navbar]");
const heroHeader = document.querySelector("header#home");
let navigationScrollFrame = 0;

function updateNavigationScrollState() {
    if (!floatingNavigation || !heroHeader) return;

    const showFloatingNavigation = window.scrollY > 112;
    floatingNavigation.classList.toggle("is-visible", showFloatingNavigation);
    floatingNavigation.setAttribute("aria-hidden", String(!showFloatingNavigation));
    floatingNavigation.inert = !showFloatingNavigation;
    if (navigation) navigation.inert = showFloatingNavigation;
    heroHeader.classList.toggle("navbar-minimized", showFloatingNavigation);
    updateActiveSection();
}

if (floatingNavigation) {
    window.addEventListener("scroll", () => {
        if (navigationScrollFrame) return;

        navigationScrollFrame = window.requestAnimationFrame(() => {
            navigationScrollFrame = 0;
            updateNavigationScrollState();
        });
    }, { passive: true });

    updateNavigationScrollState();
}

function moveGlassDrop(link) {
    if (!navigation || !glassDrop || !link) return;

    const navigationBounds = navigation.getBoundingClientRect();
    const linkBounds = link.getBoundingClientRect();
    const left = linkBounds.left - navigationBounds.left + navigation.scrollLeft;

    glassDrop.style.left = `${left}px`;
    glassDrop.style.width = `${linkBounds.width}px`;
    glassDrop.style.height = `${linkBounds.height}px`;
}

function setActiveLink(link) {
    const activeHash = typeof link === "string" ? link : link?.hash;

    navigationLinks.forEach((navigationLink) => {
        const isActive = navigationLink.hash === activeHash;
        navigationLink.classList.toggle("is-active", isActive);

        if (isActive) {
            navigationLink.setAttribute("aria-current", "page");
        } else {
            navigationLink.removeAttribute("aria-current");
        }
    });

    moveGlassDrop(topNavigationLinks.find((navigationLink) => navigationLink.hash === activeHash));
}

function updateActiveSection() {
    if (navigationSections.length === 0) return;

    const activationPoint = Math.min(280, Math.max(120, window.innerHeight * 0.28));
    let currentSection = navigationSections[0];

    for (const section of navigationSections) {
        if (section.getBoundingClientRect().top > activationPoint) break;
        currentSection = section;
    }

    setActiveLink(`#${currentSection.id}`);
}

navigationLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
        if (link.getAttribute("href") === "#") event.preventDefault();
        setActiveLink(link);
    });
});

const skillsSection = document.querySelector(".skills");

if (skillsSection) {
    const skillFilters = [...skillsSection.querySelectorAll(".skill-filter")];
    const skillCards = [...skillsSection.querySelectorAll(".skill-card")];

    skillFilters.forEach((filter) => {
        filter.addEventListener("click", () => {
            const selectedCategory = filter.dataset.skillFilter;

            skillFilters.forEach((button) => {
                const isSelected = button === filter;
                button.classList.toggle("is-active", isSelected);
                button.setAttribute("aria-pressed", String(isSelected));
            });

            skillCards.forEach((card) => {
                card.hidden = selectedCategory !== "all" && card.dataset.category !== selectedCategory;
            });
        });
    });

    const skillsObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            skillsSection.classList.add("is-visible");
            observer.disconnect();
        }
    }, { threshold: 0.08 });

    skillsObserver.observe(skillsSection);
}

const projectsSection = document.querySelector(".projects");
const API_URL = "https://portfolioweb-gmex.onrender.com";

function getAssetUrl(filePath) {
    if (!filePath) return "";
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `${API_URL}${filePath}`;
}

function isUploadedAsset(filePath) {
    return typeof filePath === "string" && (
        /^https?:\/\//i.test(filePath) ||
        /^\/uploads\/[\w-]+\.(jpg|jpeg|png|webp|pdf)(?:[?#].*)?$/i.test(filePath)
    );
}

function isPdfAsset(filePath) {
    return typeof filePath === "string" && /\.pdf(?:[?#].*)?$/i.test(filePath);
}

function createPortfolioPdfLink(filePath, label) {
    const link = document.createElement("a");
    link.className = "portfolio-document-link";
    link.href = getAssetUrl(filePath);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
}

if (projectsSection) {
    const projectsGrid = projectsSection.querySelector("[data-project-grid]");
    const projectsEmptyState = projectsSection.querySelector("[data-project-empty]");
    const projectCardTemplate = document.querySelector("#project-card-template");

    function renderFeaturedProjects(projects) {
        const projectList = Array.isArray(projects) ? projects : [];
        projectsGrid.replaceChildren();
        projectsGrid.hidden = projectList.length === 0;
        projectsEmptyState.hidden = projectList.length > 0;

        projectList.forEach((project) => {
            const projectCard = projectCardTemplate.content.firstElementChild.cloneNode(true);
            const projectImage = projectCard.querySelector("[data-project-image]");

            if (isUploadedAsset(project.imageUrl) && isPdfAsset(project.imageUrl)) {
                projectImage.remove();
                const projectImageArea = projectCard.querySelector(".project-card-image");
                const projectCategory = projectCard.querySelector("[data-project-category]");
                projectImageArea.insertBefore(createPortfolioPdfLink(project.imageUrl, "View project PDF"), projectCategory);
            } else if (isUploadedAsset(project.imageUrl)) {
                projectImage.src = getAssetUrl(project.imageUrl);
                projectImage.alt = `${project.title || "Project"} preview`;
            } else {
                projectImage.remove();
            }

            projectCard.querySelector("[data-project-category]").textContent = project.category || "Project";
            projectCard.querySelector("[data-project-title]").textContent = project.title || "";
            projectCard.querySelector("[data-project-description]").textContent = project.description || "";

            const projectTags = projectCard.querySelector("[data-project-tags]");
            (Array.isArray(project.technologies) ? project.technologies : []).forEach((technology) => {
                const tag = document.createElement("li");
                tag.textContent = technology;
                projectTags.append(tag);
            });

            [
                ["[data-project-demo]", project.liveUrl],
                ["[data-project-github]", project.githubUrl]
            ].forEach(([selector, url]) => {
                const link = projectCard.querySelector(selector);
                if (url) {
                    link.href = url;
                } else {
                    link.hidden = true;
                }
            });

            projectsGrid.append(projectCard);
        });
    }

    window.renderFeaturedProjects = renderFeaturedProjects;
    renderFeaturedProjects([]);

    const projectsObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            projectsSection.classList.add("is-visible");
            observer.disconnect();
        }
    }, { threshold: 0.08 });

    projectsObserver.observe(projectsSection);
}

const experienceSection = document.querySelector(".experience");

if (experienceSection) {
    const experienceObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            experienceSection.classList.add("is-visible");
            observer.disconnect();
        }
    }, { threshold: 0.08 });

    experienceObserver.observe(experienceSection);
}

function prepareAchievementCard(card) {
    card.tabIndex = 0;
    card.setAttribute("aria-haspopup", "dialog");
    const title = card.querySelector("[data-achievement-title]")?.textContent.trim();
    if (title) card.setAttribute("aria-label", `Open achievement details for ${title}`);
}

const achievementsSection = document.querySelector(".achievements");

if (achievementsSection) {
    const achievementsFeedback = achievementsSection.querySelector("[data-achievement-feedback]");
    const achievementDialog = document.querySelector("[data-achievement-dialog]");
    const dialogMedia = achievementDialog.querySelector("[data-achievement-dialog-media]");
    const dialogDetails = achievementDialog.querySelector("[data-achievement-dialog-details]");
    const closeDialogButton = achievementDialog.querySelector("[data-achievement-dialog-close]");
    let activeAchievementCard = null;

    function openAchievementDialog(card) {
        activeAchievementCard = card;
        const media = card.querySelector("[data-achievement-image]")?.cloneNode(true);
        const details = card.querySelector(".achievement-card-content")?.cloneNode(true);
        media?.querySelectorAll("[data-demo-action]").forEach((button) => button.remove());
        dialogMedia.replaceChildren(...(media ? [media] : []));
        dialogDetails.replaceChildren(...(details ? [details] : []));

        const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty("--achievement-scrollbar-gap", `${scrollbarGap}px`);
        document.body.classList.add("achievement-dialog-open");
        achievementDialog.showModal();
        closeDialogButton.focus({ preventScroll: true });
    }

    function closeAchievementDialog() {
        if (achievementDialog.open) achievementDialog.close();
    }

    achievementsSection.querySelectorAll("[data-achievement]").forEach(prepareAchievementCard);

    achievementDialog.addEventListener("close", () => {
        document.body.classList.remove("achievement-dialog-open");
        document.documentElement.style.removeProperty("--achievement-scrollbar-gap");
        activeAchievementCard?.focus({ preventScroll: true });
        activeAchievementCard = null;
    });

    closeDialogButton.addEventListener("click", closeAchievementDialog);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && achievementDialog.open) {
            event.preventDefault();
            closeAchievementDialog();
        }
    });
    achievementDialog.addEventListener("click", (event) => {
        if (event.target === achievementDialog) closeAchievementDialog();
    });

    achievementsSection.addEventListener("click", (event) => {
        const demoButton = event.target.closest("[data-demo-action]");
        if (demoButton) {
            achievementsFeedback.textContent = demoButton.dataset.demoAction === "image" ?
                "Image upload is a visual demo and is not enabled yet." :
                "Adding achievements is a visual demo and does not save changes.";
            return;
        }

        const card = event.target.closest("[data-achievement]");
        if (card) openAchievementDialog(card);
    });

    achievementsSection.addEventListener("keydown", (event) => {
        if (event.target.matches("[data-achievement]") && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openAchievementDialog(event.target);
        }
    });

    const achievementsObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            achievementsSection.classList.add("is-visible");
            observer.disconnect();
        }
    }, { threshold: 0.08 });

    achievementsObserver.observe(achievementsSection);
}

const blogSection = document.querySelector(".blog");

if (blogSection) {
    const blogGrid = blogSection.querySelector("[data-blog-grid]");
    const blogFeedback = blogSection.querySelector("[data-blog-feedback]");
    const blogCardTemplate = document.querySelector("#blog-card-template");

    function renderBlogPosts(posts) {
        const placeholderPosts = [
            { placeholder: true, featured: true, order: 0 },
            { placeholder: true, order: 1 },
            { placeholder: true, order: 2 }
        ];
        const postList = Array.isArray(posts) && posts.length > 0 ? [...posts].sort((first, second) => (first.order ?? 0) - (second.order ?? 0)) :
            placeholderPosts;

        blogGrid.replaceChildren();

        postList.forEach((post, index) => {
            const blogCard = blogCardTemplate.content.firstElementChild.cloneNode(true);
            const coverImage = blogCard.querySelector("[data-blog-cover-image]");
            const coverPlaceholder = blogCard.querySelector("[data-blog-cover-placeholder]");
            const coverAddButton = blogCard.querySelector('[data-blog-demo="image"]');
            const isFeatured = Boolean(post.featured || post.placeholder && index === 0);

            blogCard.classList.toggle("blog-card-featured", isFeatured);
            blogCard.style.setProperty("--blog-index", index);
            blogCard.dataset.featured = String(isFeatured);
            blogCard.querySelector("[data-blog-featured-label]").hidden = !post.placeholder || !isFeatured;

            if (isUploadedAsset(post.coverImageUrl) && isPdfAsset(post.coverImageUrl)) {
                coverImage.hidden = true;
                coverPlaceholder.hidden = true;
                coverAddButton.hidden = true;
                const category = blogCard.querySelector("[data-blog-category]");
                blogCard.querySelector("[data-blog-cover-area]").insertBefore(
                    createPortfolioPdfLink(post.coverImageUrl, "View article PDF"),
                    category
                );
            } else if (isUploadedAsset(post.coverImageUrl)) {
                coverImage.src = getAssetUrl(post.coverImageUrl);
                coverImage.alt = post.title ? `${post.title} cover image` : "Article cover image";
                coverImage.hidden = false;
                coverPlaceholder.hidden = true;
                coverAddButton.hidden = true;
            }

            blogCard.querySelector("[data-blog-category]").textContent = post.category || "Category";
            blogCard.querySelector("[data-blog-title]").textContent = post.title || "Article title";
            blogCard.querySelector("[data-blog-excerpt]").textContent = post.excerpt || "Short description";
            blogCard.querySelector("[data-blog-reading-time]").textContent = post.readingTime || "Reading time";

            const publicationDate = blogCard.querySelector("[data-blog-date]");
            publicationDate.textContent = post.date || post.publishedAt || "Publication date";
            if (post.date || post.publishedAt) publicationDate.dateTime = post.date || post.publishedAt;

            const tagsList = blogCard.querySelector("[data-blog-tags]");
            (Array.isArray(post.tags) ? post.tags : []).forEach((tagText) => {
                const tag = document.createElement("li");
                tag.textContent = tagText;
                tagsList.append(tag);
            });
            tagsList.hidden = tagsList.childElementCount === 0;

            const fullContent = blogCard.querySelector("[data-blog-full-content]");
            if (post.content) {
                fullContent.textContent = post.content;
                fullContent.hidden = false;
            }

            const readMoreLink = blogCard.querySelector("[data-blog-read-more]");
            if (post.url) readMoreLink.href = post.url;
            readMoreLink.dataset.placeholder = String(!post.url);

            blogGrid.append(blogCard);
        });
    }

    window.renderBlogPosts = renderBlogPosts;
    renderBlogPosts([]);

    blogSection.addEventListener("click", (event) => {
        const demoButton = event.target.closest("[data-blog-demo]");
        if (demoButton) {
            blogFeedback.textContent = demoButton.dataset.blogDemo === "image" ?
                "Cover image upload is a visual demo and is not enabled yet." :
                "Adding articles is a visual demo and does not save changes.";
            return;
        }

        const readMoreLink = event.target.closest("[data-blog-read-more]");
        if (readMoreLink?.dataset.placeholder === "true") {
            event.preventDefault();
            blogFeedback.textContent = "Article previews will be available when posts are published.";
        }
    });

    window.renderBlogPosts = renderBlogPosts;

    const blogObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            blogSection.classList.add("is-visible");
            observer.disconnect();
        }
    }, { threshold: 0.08 });

    blogObserver.observe(blogSection);
}

const reviewsSection = document.querySelector(".reviews");

if (reviewsSection) {
    const reviewTrack = reviewsSection.querySelector("[data-review-track]");
    const reviewViewport = reviewsSection.querySelector("[data-review-viewport]");
    const reviewPagination = reviewsSection.querySelector("[data-review-pagination]");
    const reviewFeedback = reviewsSection.querySelector("[data-review-feedback]");
    const reviewCardTemplate = document.querySelector("#review-card-template");
    const previousReviewButton = reviewsSection.querySelector("[data-review-previous]");
    const nextReviewButton = reviewsSection.querySelector("[data-review-next]");
    let reviewScrollFrame = 0;

    function updateReviewControls() {
        const reviewCards = [...reviewTrack.querySelectorAll("[data-review-card]")];
        if (reviewCards.length === 0) return;

        const viewportCenter = reviewViewport.getBoundingClientRect().left + reviewViewport.clientWidth / 2;
        const activeIndex = reviewCards.reduce((closestIndex, card, index) => {
            const cardCenter = card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2;
            const closestCardCenter = reviewCards[closestIndex].getBoundingClientRect().left + reviewCards[closestIndex].getBoundingClientRect().width / 2;
            return Math.abs(cardCenter - viewportCenter) < Math.abs(closestCardCenter - viewportCenter) ? index : closestIndex;
        }, 0);

        reviewPagination.querySelectorAll(".review-page").forEach((pageButton, index) => {
            if (index === activeIndex) {
                pageButton.setAttribute("aria-current", "true");
            } else {
                pageButton.removeAttribute("aria-current");
            }
        });

        previousReviewButton.disabled = reviewViewport.scrollLeft <= 2;
        nextReviewButton.disabled = reviewViewport.scrollLeft + reviewViewport.clientWidth >= reviewTrack.scrollWidth - 2;
    }

    function renderReviews(reviews) {
        const placeholderReviews = [
            { placeholder: true, order: 0 },
            { placeholder: true, order: 1 },
            { placeholder: true, order: 2 }
        ];
        const reviewList = Array.isArray(reviews) && reviews.length > 0 ? [...reviews].sort((first, second) => (first.order ?? 0) - (second.order ?? 0)) :
            placeholderReviews;

        reviewTrack.replaceChildren();
        reviewPagination.replaceChildren();

        reviewList.forEach((review, index) => {
            const reviewCard = reviewCardTemplate.content.firstElementChild.cloneNode(true);
            const reviewerImage = reviewCard.querySelector("[data-review-image]");
            const imagePlaceholder = reviewCard.querySelector("[data-review-image-placeholder]");
            const imageAddButton = reviewCard.querySelector('[data-review-demo="image"]');
            const rating = Math.min(5, Math.max(0, Number(review.rating) || 0));

            reviewCard.style.setProperty("--review-index", index);
            reviewCard.dataset.featured = String(Boolean(review.featured));
            reviewCard.querySelector("[data-review-name]").textContent = review.name || "Reviewer Name";
            reviewCard.querySelector("[data-review-role]").textContent = review.role || "Role / Organization";

            const organization = reviewCard.querySelector("[data-review-organization]");
            if (review.organization) {
                organization.textContent = review.organization;
                organization.hidden = false;
            }

            if (isUploadedAsset(review.profileImageUrl) && isPdfAsset(review.profileImageUrl)) {
                imagePlaceholder.hidden = true;
                imageAddButton.hidden = true;
                reviewCard.append(createPortfolioPdfLink(review.profileImageUrl, "View profile PDF"));
            } else if (isUploadedAsset(review.profileImageUrl)) {
                reviewerImage.src = getAssetUrl(review.profileImageUrl);
                reviewerImage.alt = `${review.name || "Reviewer"} profile image`;
                reviewerImage.hidden = false;
                imagePlaceholder.hidden = true;
                imageAddButton.hidden = true;
            }

            reviewCard.querySelector("[data-review-text]").textContent = review.text || "Your testimonial will appear here.";

            const ratingDisplay = reviewCard.querySelector("[data-review-rating]");
            ratingDisplay.setAttribute("aria-label", rating > 0 ? `${rating} out of 5 stars` : "No rating yet, 5 stars available");
            ratingDisplay.querySelectorAll("i").forEach((star, starIndex) => {
                star.classList.toggle("fa-solid", starIndex < rating);
                star.classList.toggle("fa-regular", starIndex >= rating);
            });

            const reviewDate = reviewCard.querySelector("[data-review-date]");
            if (review.date) {
                reviewDate.textContent = review.date;
                reviewDate.dateTime = review.date;
                reviewDate.hidden = false;
            }

            reviewTrack.append(reviewCard);

            const pageButton = document.createElement("button");
            pageButton.className = "review-page";
            pageButton.type = "button";
            pageButton.setAttribute("aria-label", `Go to review ${index + 1}`);
            pageButton.addEventListener("click", () => {
                reviewCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
            });
            reviewPagination.append(pageButton);
        });

        updateReviewControls();
    }

    function scrollReviews(direction) {
        const firstCard = reviewTrack.querySelector("[data-review-card]");
        if (!firstCard) return;

        const cardGap = Number.parseFloat(getComputedStyle(reviewTrack).gap) || 0;
        reviewViewport.scrollBy({
            left: direction * (firstCard.getBoundingClientRect().width + cardGap),
            behavior: "smooth"
        });
    }

    renderReviews([]);

    previousReviewButton.addEventListener("click", () => scrollReviews(-1));
    nextReviewButton.addEventListener("click", () => scrollReviews(1));
    reviewViewport.addEventListener("scroll", () => {
        if (reviewScrollFrame) cancelAnimationFrame(reviewScrollFrame);
        reviewScrollFrame = requestAnimationFrame(updateReviewControls);
    }, { passive: true });

    reviewsSection.addEventListener("click", (event) => {
        const demoButton = event.target.closest("[data-review-demo]");
        if (!demoButton) return;

        reviewFeedback.textContent = demoButton.dataset.reviewDemo === "image" ?
            "Profile image upload is a visual demo and is not enabled yet." :
            "Adding reviews is a visual demo and does not save changes.";
    });

    window.renderReviews = renderReviews;

    const reviewsObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            reviewsSection.classList.add("is-visible");
            observer.disconnect();
        }
    }, { threshold: 0.08 });

    reviewsObserver.observe(reviewsSection);

    window.addEventListener("resize", updateReviewControls);
}

const contactSection = document.querySelector(".contact");

if (contactSection) {
    const contactForm = contactSection.querySelector("[data-contact-form]");
    const contactFeedback = contactSection.querySelector("[data-contact-feedback]");

    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!contactForm.reportValidity()) return;

        contactFeedback.textContent = "Your message is ready. This frontend demo does not send or store it.";
    });

    const contactObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            contactSection.classList.add("is-visible");
            observer.disconnect();
        }
    }, { threshold: 0.08 });

    contactObserver.observe(contactSection);
}

window.addEventListener("resize", () => {
    const activeLink = navigationLinks.find((link) => link.classList.contains("is-active"));
    moveGlassDrop(topNavigationLinks.find((navigationLink) => navigationLink.hash === activeLink?.hash));
    updateNavigationScrollState();
});

updateNavigationScrollState();

function renderSkills(skills) {
    const section = document.querySelector(".skills");
    const grid = section?.querySelector(".skills-grid");
    const filters = section?.querySelector(".skills-filters");
    const template = grid?.querySelector(".skill-card");
    if (!grid || !filters || !template) return;

    const categories = [...new Set(skills.map((skill) => skill.category || "Other"))];
    const categoryKey = (category) => category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filterNames = ["all", ...categories.map(categoryKey)];
    filters.replaceChildren();
    filterNames.forEach((key, index) => {
        const category = index === 0 ? "All" : categories[index - 1];
        const button = document.createElement("button");
        button.type = "button";
        button.className = `skill-filter${index === 0 ? " is-active" : ""}`;
        button.dataset.skillFilter = key;
        button.setAttribute("aria-pressed", String(index === 0));
        button.append(document.createTextNode(category));
        const count = document.createElement("span");
        count.textContent = index === 0 ? skills.length : skills.filter((skill) => categoryKey(skill.category || "Other") === key).length;
        button.append(" ", count);
        button.addEventListener("click", () => {
            filters.querySelectorAll(".skill-filter").forEach((filter) => {
                const selected = filter === button;
                filter.classList.toggle("is-active", selected);
                filter.setAttribute("aria-pressed", String(selected));
            });
            grid.querySelectorAll(".skill-card").forEach((card) => {
                card.hidden = key !== "all" && card.dataset.category !== key;
            });
        });
        filters.append(button);
    });

    grid.replaceChildren();
    skills.forEach((skill, index) => {
        const card = template.cloneNode(true);
        const level = Math.min(100, Math.max(0, Number(skill.level) || 0));
        card.dataset.category = categoryKey(skill.category || "Other");
        card.style.setProperty("--skill-index", index);
        card.querySelector(".skill-icon i").className = skill.icon || "fa-solid fa-code";
        card.querySelector(".skill-category").textContent = skill.category || "Other";
        card.querySelector("h3").textContent = skill.name || "";
        card.querySelector("p").textContent = skill.description || "";
        card.querySelector(".skill-meter-label span:last-child").textContent = `${level}%`;
        const meter = card.querySelector(".skill-meter");
        meter.setAttribute("aria-label", `${skill.name} proficiency`);
        meter.setAttribute("aria-valuenow", level);
        meter.querySelector("span").style.setProperty("--skill-level", `${level}%`);
        grid.append(card);
    });
}

function renderAchievements(achievements) {
    const grid = document.querySelector("[data-achievement-list]");
    const template = grid?.querySelector("[data-achievement]");
    if (!grid || !template) return;

    grid.replaceChildren();
    achievements.forEach((achievement, index) => {
        const card = template.cloneNode(true);
        prepareAchievementCard(card);
        card.dataset.year = achievement.year || "";
        card.style.setProperty("--achievement-index", index);
        const year = card.querySelector("[data-achievement-year]");
        year.textContent = achievement.year || "";
        year.dateTime = achievement.year || "";
        card.querySelector("[data-achievement-award]").textContent = achievement.award || "Achievement";
        card.querySelector("[data-achievement-title]").textContent = achievement.title || "";
        card.querySelector("[data-achievement-organization]").textContent = achievement.organization || "";
        card.querySelector("[data-achievement-description]").textContent = achievement.description || "";
        if (isUploadedAsset(achievement.imageUrl) && isPdfAsset(achievement.imageUrl)) {
            card.querySelector("[data-achievement-image]").replaceChildren(
                createPortfolioPdfLink(achievement.imageUrl, "View achievement PDF")
            );
        } else if (isUploadedAsset(achievement.imageUrl)) {
            const image = document.createElement("img");
            image.src = getAssetUrl(achievement.imageUrl);
            image.alt = `${achievement.title || "Achievement"} image`;
            image.loading = "lazy";
            const imageArea = card.querySelector("[data-achievement-image]");
            imageArea.classList.add("has-certificate-image");
            imageArea.replaceChildren(image);
        }
        grid.append(card);
    });
}

function renderExperience(experiences) {
    const timeline = document.querySelector(".experience-timeline");
    const template = timeline?.querySelector(".experience-item");
    if (!timeline || !template) return;

    timeline.replaceChildren();
    experiences.forEach((experience, index) => {
        const item = template.cloneNode(true);
        item.style.setProperty("--experience-index", index);
        const dates = item.querySelectorAll(".experience-date span");
        dates[0].textContent = experience.startDate || "";
        dates[1].textContent = experience.endDate || "Present";
        item.querySelector(".experience-card h3").textContent = experience.position || "";
        item.querySelector(".experience-type").textContent = experience.organization || "Experience";
        item.querySelector(".experience-summary").textContent = experience.description || "";
        const details = item.querySelector(".experience-details");
        details.replaceChildren();
        (Array.isArray(experience.technologies) ? experience.technologies : []).forEach((technology) => {
            const entry = document.createElement("li");
            entry.textContent = technology;
            details.append(entry);
        });
        if (!details.childElementCount) details.hidden = true;
        item.querySelector(".experience-icon i").className = "fa-solid fa-briefcase";
        timeline.append(item);
    });
}
async function loadPortfolioContent() {
    const sections = [
        ["projects", (items) => window.renderFeaturedProjects?.(items)],
        ["achievements", renderAchievements],
        ["blog", (items) => window.renderBlogPosts?.(items)],
        ["reviews", (items) => window.renderReviews?.(items)],
        ["skills", renderSkills],
        ["experience", renderExperience]
    ];

    await Promise.all(sections.map(async ([name, render]) => {
        try {
            const response = await fetch(`${API_URL}/api/${name}`);
            if (response.ok) render(await response.json());
        } catch {
            // Keep the existing page content if the API is unavailable.
        }
    }));
}

loadPortfolioContent();