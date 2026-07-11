//========================
// Meridian Relationship
//========================

const relationship = {

    level: 1,

    affinity: 18,

    trustToday: 0,

    totalTrust: 18,

    firstLaunch: null

};

//========================
// 初回起動日
//========================

function normalizeRelationshipProgress() {
    relationship.totalTrust = Number(relationship.totalTrust) || 0;

    relationship.level =
        Math.floor(relationship.totalTrust / 100) + 1;

    relationship.affinity =
        relationship.totalTrust % 100;
}

function initializeRelationship(){

    const saved = localStorage.getItem("relationship");

    if(saved){

        Object.assign(
            relationship,
            JSON.parse(saved)
        );

    }else{

        relationship.firstLaunch = Date.now();

        saveRelationship();

    }

    normalizeRelationshipProgress();
    saveRelationship();
    renderRelationship();

}

function saveRelationship(){

    localStorage.setItem(
        "relationship",
        JSON.stringify(relationship)
    );

}

//========================
// 表示
//========================

function renderRelationship(){

    const level =
        document.getElementById("relationshipLevel");

    const affinity =
        document.getElementById("relationshipAffinity");

    const trust =
        document.getElementById("relationshipTrust");

    const days =
        document.getElementById("relationshipDays");

    const fill =
        document.querySelector(".relationship-fill");

    if(level){

        level.textContent =
            "Partner Lv." + relationship.level;

    }

    if(affinity){

        affinity.textContent =
            relationship.affinity + "%";

    }

    if(trust){

        trust.textContent =
            "+" + relationship.trustToday;

    }

    if(days){

        const diff =
            Math.floor(
                (Date.now() - relationship.firstLaunch)
                /86400000
            ) + 1;

        days.textContent = diff;

    }

    if(fill){

        fill.style.width =
            relationship.affinity + "%";

    }

}

//========================
// Trust追加
//========================

function addTrust(value){

    relationship.trustToday += value;

    relationship.totalTrust += value;

    normalizeRelationshipProgress();

    saveRelationship();

    renderRelationship();

}

initializeRelationship();

