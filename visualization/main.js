import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

function generateMonthLabels() {
  const months = [
    "March 2020", "April 2020", "May 2020", "June 2020", 
    "July 2020", "August 2020", "September 2020", "October 2020",
    "November 2020", "December 2020", "January 2021", "February 2021"
  ];
  return months;
}

function populateDropdowns() {
  const months = generateMonthLabels();
  const startSelect = document.getElementById("startMonth");
  const endSelect = document.getElementById("endMonth");
  
  // Clear existing options
  startSelect.innerHTML = '';
  endSelect.innerHTML = '';
  
  // Assign repsective months to 1 - 12
  months.forEach((month, index) => {
    const startOption = new Option(month, index + 1);
    const endOption = new Option(month, index + 1);
    
    startSelect.add(startOption);
    endSelect.add(endOption);
  });
  
  // Set default values (March 2020 to February 2021)
  startSelect.value = 1;
  endSelect.value = 12;
}

async function loadData(){
    const data = await d3.csv('visualization/all_months.csv', (row) => ({
        ...row,
        xpx: +row.x_px, // or just +row.line
        ypx: +row.y_px,
        month: +row.month,
        avgNDSI: +row.avgNDSI
  }));
    return data;
}

// Do not touch
const width = 512;
const height = 512;
const gridSize = 128;
const cellSize = width / gridSize;

// Creates the canvas
const svg = d3.select("#viz")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Do not touch
const landmarkLayer = svg.append("g");
// hard coded to fit for 128x128
const landmarks = [
  { name: "Amundsen-Scott", pixelX: 280, pixelY: 215 },
  { name: "McMurdo Sound", pixelX: 300, pixelY: 350 },
  { name: "Vinson Massif", pixelX: 150, pixelY: 280 },
  { name: "Vernadsky Base", pixelX: 32, pixelY: 157 }
];

function drawLandmarks() {
  landmarkLayer.selectAll("*").remove()
  
  landmarkLayer.selectAll("circle")
    .data(landmarks)
    .join("circle")
    .attr("cx", d => d.pixelX)
    .attr("cy", d => d.pixelY)
    .attr("r", 3.5)
    .attr("fill", "black")
    .attr("stroke", "white")
    .attr("stroke-width", 2);

  landmarkLayer.selectAll("text")
    .data(landmarks)
    .join("text")
    .attr("x", d => d.pixelX)
    .attr("y", d => d.pixelY - 8)
    .text(d => d.name)
    .attr("font-size", "13px")
    .attr("fill", "black")
    .attr("font-weight", "bold") 
    .attr("text-anchor", "right");

    landmarkLayer.raise()
}


function drawLegend(thresholds, colors) {
  const legendContainer = d3.select("#legend");
  legendContainer.html(""); // Clear previous legend

  // Add title
  legendContainer.append("div")
    .text("Legend")
    .style("font-weight", "bold")
    .style("margin-bottom", "6px");

  const legendData = [
    { color: colors[0], label: `< ${thresholds[0].toFixed(0)}%`},
    { color: colors[1], label: `${thresholds[0].toFixed(0)} – 0%`},
    { color: colors[2], label: `0%` },
    { color: colors[3], label: `${thresholds[2].toFixed(0)} – ${thresholds[3].toFixed(0)}%` },
    { color: colors[4], label: `> ${thresholds[2].toFixed(0)}%` }
  ];

  // Each legend row: flex container
  const legendItems = legendContainer.selectAll(".legendItem")
    .data(legendData)
    .join("div")
    .attr("class", "legendItem")
    .style("display", "flex")
    .style("align-items", "center")
    .style("margin-bottom", "4px");

  // Color box
  legendItems.append("div")
    .style("width", "20px")
    .style("height", "20px")
    .style("background-color", d => d.color)
    .style("margin-right", "6px")
    .style("flex-shrink", "0"); // Prevent color box from shrinking

  // Label text
  legendItems.append("div")
    .text(d => d.label)
    .style("font-size", "12px")
    .style("white-space", "nowrap"); // Prevent text wrapping
}

function identifySeaPixels(data) {
  const pixelCounts = new Map();
  
  // Count months with avgNDSI === 0 for each pixel
  data.forEach(d => {
    const key = `${d.xpx},${d.ypx}`;
    if (d.avgNDSI === 0) {
      pixelCounts.set(key, (pixelCounts.get(key) || 0) + 1);
    }
  });
  
  // Return Set of pixels that have 12 months with avgNDSI === 0
  const seaPixels = new Set();
  pixelCounts.forEach((count, key) => {
    if (count === 12) {
      seaPixels.add(key);
    }
  });
  
  console.log(`Identified ${seaPixels.size} sea pixels`);
  return seaPixels;
}

function drawHeatmap(data, startMo = 1, endMo = 12, monthLabels = null) {
  if (startMo >= endMo) { 
    console.error("Start month must be < end month."); 
    return; 
  }

  svg.selectAll("rect").remove();

  const seaPixels = identifySeaPixels(data);

  const startMoMean = data.filter(d => d.month === startMo)
    .map(d => ({ xpx: d.xpx, ypx: d.ypx, avgNDSI: d.avgNDSI }))
    .sort((a,b) => d3.ascending(a.xpx,b.xpx) || d3.ascending(a.ypx,b.ypx));

  const endMoMean = data.filter(d => d.month === endMo)
    .map(d => ({ xpx: d.xpx, ypx: d.ypx, avgNDSI: d.avgNDSI }))
    .sort((a,b) => d3.ascending(a.xpx,b.xpx) || d3.ascending(a.ypx,b.ypx));

  if (startMoMean.length === 0 || endMoMean.length === 0) {
    console.error(`No data found for months ${startMo} and/or ${endMo}`);
    return;
  }

  const diffMoMean = startMoMean.map((d,i) => ({
    xpx: d.xpx,
    ypx: d.ypx,
    diff: endMoMean[i].avgNDSI - d.avgNDSI,
    isSea: seaPixels.has(`${d.xpx},${d.ypx}`)
  }));

  const thresholds = [-25, 0, 0.00001, 25];
  const colors = ["#d73027","#fc8d59","#ffffbf","#91bfdb","#4575b4"];
  const colorScale = d3.scaleThreshold().domain(thresholds).range(colors);
  console.log(thresholds)

  // Heatmap
  svg.selectAll("rect")
    .data(diffMoMean)
    .join("rect")
    .attr("x", d => (d.xpx - 1) * cellSize)
    .attr("y", d => (d.ypx - 1) * cellSize)
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("fill", d => {
      if (d.isSea) {
        return "#2c3e50"; // Dark blue-gray for sea
      }
      return colorScale(d.diff);
    })
    .attr("opacity", d => d.isSea ? 0.0 : 1); // Optional: adjust opacity for sea

  // Legend + Landmarks on top
  drawLegend(thresholds, colors);
  drawLandmarks();

  const brush = d3.brush()
  .extent([[0, 0], [width, height]])
  .on("start brush end", brushed);

  svg.selectAll(".brush").remove(); // clear previous brushes
  svg.append("g")
    .attr("class", "brush")
    .call(brush);

  // Change title if not default
  if (monthLabels) {
    const title = document.getElementById("heatmapTitle");
    title.textContent = `Change in Snow Coverage by Antarctica between ${monthLabels[startMo-1]} to ${monthLabels[endMo-1]}`;
  }

}

function brushed(event) {
  const selection = event.selection;
  if (!selection) {
    d3.select("#brushStats").html("No region selected");
    return;
  }

  const [[x0, y0], [x1, y1]] = selection;

  // Find all rects inside the selection
  const selected = [];
  d3.selectAll("rect").each(function(d) {
    const x = (d.xpx - 1) * cellSize;
    const y = (d.ypx - 1) * cellSize;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && !d.isSea) {
      selected.push(d3.select(this).attr("fill"));
    }
  });

  const colorInfo = [
    { color: "#d73027", label: "Significant Decrease in NDSI" },
    { color: "#fc8d59", label: "Moderate Decrease in NDSI" },
    { color: "#ffffbf", label: "No Significant Change" },
    { color: "#91bfdb", label: "Moderate Increase in NDSI" },
    { color: "#4575b4", label: "Significant Increase in NDSI" }
  ];

  // Count by color
  const colorCounts = d3.rollup(selected, v => v.length, d => d);
  
  // Convert to readable HTML
  let html = `<strong>${(selected.length/(128*128 - 9479)*100).toFixed(2)}%</strong> of Antarctica selected:<br>`;
  colorInfo.forEach(({color, label}) => {
      const count = colorCounts.get(color) || 0;
      if (count > 0) {
        html += `
          <div style="display:flex;align-items:center;margin:2px 0;">
            <div style="width:14px;height:14px;background:${color};margin-right:5px;border:1px solid #ccc;"></div>
            ${(count / (128 * 128 - 9479) * 100).toFixed(3)}%  ${label}
          </div>`;
      }
  });

  document.getElementById("brushStats").innerHTML = html;

  // if (event.type === "end") svg.select(".brush").call(d3.brush().move, null);
}

async function init() {
    const data = await loadData();

    populateDropdowns();
    
    // Small delay to ensure DOM is fully updated
    // await new Promise(resolve => setTimeout(resolve, 100));
    
    const updateButton = document.getElementById("updateButton");
    if (updateButton) {
      const months = generateMonthLabels();

      updateButton.onclick = () => {
        const startMonth = parseInt(document.getElementById("startMonth").value);
        const endMonth = parseInt(document.getElementById("endMonth").value);
        
        if (startMonth >= endMonth) {
          alert("Start month must be before end month");
          return;
        }
        
        drawHeatmap(data, startMonth, endMonth, months);
      };
    }
    
    // Draw initial heatmap
    drawHeatmap(data, 1, 12);
  }
// Start the application
init();
