const search = document.getElementById("search");

if(search){
  search.addEventListener("input",()=>{
    const value = search.value.toLowerCase();

    document.querySelectorAll(".card").forEach(card=>{
      card.style.display = card.innerText.toLowerCase().includes(value)
        ? "block"
        : "none";
    });
  });
}
