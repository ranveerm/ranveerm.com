// Create image cloud
// - Resources: [How to get the CSS width/height of a container element?](https://stackoverflow.com/questions/58738691/how-to-get-the-css-width-height-of-a-container-element)

function createImageCloud(imageDir, data, className) {
    let parsedData = JSON.parse(JSON.stringify(data));
    const numberOfImages = parsedData.length

    // specify svg width and height;
    // TODO: Determine width of container
    const width = getPageWidth();
    const height = 700;
    console.log(document.getElementById(className).offsetWidth)
    // const listenTo = Math.min(width, height);
    // create svg and g DOM elements;
    let svg = d3.select('div#' + className)
        .append('svg')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('width', width)
        .attr('height', width)
        .append('g')
        // move 0,0 to the center
        .attr('transform', `translate(${width >>1}, ${height>>1})`);

    var images = [], maxImages = 200, maxWeight = 1, minWeight = 0.75, padding=3;
    for(let i = 0; i< numberOfImages; i++){
        const weight = (Math.random() *(maxWeight - minWeight)) + minWeight;

        // Debugging
        // d3.select("div.image-cloud")
        //     .append("p")
        //     .text(imageDir + parsedData[i].photo)
        //     .style("color", "red");

        images.push({
            url: imageDir + parsedData[i].photo,
            weight
        })
    }
    // make one image with a weight 3 times bigger for visualization testing propouses
   /* // images.push({
    //     url: `https://via.placeholder.com/100?text=${maxWeight * 3}`,
    //     weight: maxWeight * 3,
    //     fx: 0,
    //     fy: 0
    // })*/

    images.sort((a, b) => b.weight - a.weight);

    // make it so the biggest images is equal to 10% of canvas, and the smallest one 1%
    let scl = ((100 / numberOfImages) / 100);
    let miisp = 0.9;
    console.log(scl)
    if (scl <= miisp) scl = scl / maxImages;
    const maxImageSize = width * 0.3;
    const minImageSize = width * 0.2;

    // function to scale the images
    const scaleSize = d3.scaleLinear().domain([minWeight, maxWeight*3]).range([minImageSize, maxImageSize]).clamp(true);

    // append the rects
    let vizImages = svg.selectAll('.image-cloud-image')
        .data(images)
        .enter()
        .append('svg:image')
        .attr('class', '.image-cloud-image')
        .attr('height', d => scaleSize(d.weight))
        .attr('width', d => scaleSize(d.weight))
        .attr('id', d => d.url)
        .attr('xlink:href', d => d.url);
    vizImages.exit().remove();

    // create the collection of forces
    const simulation = d3.forceSimulation()
        // set the nodes for the simulation to be our images
        .nodes(images)
        // set the function that will update the view on each 'tick'
        .on('tick', ticked)
        .force('center', d3.forceCenter())
        .force('cramp', d3.forceManyBody().strength(width / 100))
        // collition force for rects
        .force('collide', rectCollide().size(d=> {
            const s = scaleSize(d.weight);
            return [s + padding, s + padding];
        }));

// Returns path data for a rectangle with rounded right corners.
// The top-left corner is ⟨x,y⟩.
// - Resources: https://gist.github.com/mbostock/3468167
    function rightRoundedRect(x, y, width, height, radius) {
        return "M" + x + "," + y
            + "h" + (width - radius)
            + "a" + radius + "," + radius + " 0 0 1 " + radius + "," + radius
            + "v" + (height - 2 * radius)
            + "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + radius
            + "h" + (radius - width)
            + "z";
    }
// update the position to new x and y
    function ticked(){
        vizImages.attr('x', d => d.x).attr('y', d=> d.y);
    }

// Rect collition algorithm. i don't know exactly how it works
// https://bl.ocks.org/cmgiven/547658968d365bcc324f3e62e175709b
    function rectCollide() {
        var nodes, sizes, masses
        var size = constant([0, 0])
        var strength = 1
        var iterations = 1

        function force() {
            var node, size, mass, xi, yi
            var i = -1
            while (++i < iterations) { iterate() }

            function iterate() {
                var j = -1
                var tree = d3.quadtree(nodes, xCenter, yCenter).visitAfter(prepare)

                while (++j < nodes.length) {
                    node = nodes[j]
                    size = sizes[j]
                    mass = masses[j]
                    xi = xCenter(node)
                    yi = yCenter(node)

                    tree.visit(apply)
                }
            }

            function apply(quad, x0, y0, x1, y1) {
                var data = quad.data
                var xSize = (size[0] + quad.size[0]) / 2
                var ySize = (size[1] + quad.size[1]) / 2
                if (data) {
                    if (data.index <= node.index) { return }

                    var x = xi - xCenter(data)
                    var y = yi - yCenter(data)
                    var xd = Math.abs(x) - xSize
                    var yd = Math.abs(y) - ySize

                    if (xd < 0 && yd < 0) {
                        var l = Math.sqrt(x * x + y * y)
                        var m = masses[data.index] / (mass + masses[data.index])

                        if (Math.abs(xd) < Math.abs(yd)) {
                            node.vx -= (x *= xd / l * strength) * m
                            data.vx += x * (1 - m)
                        } else {
                            node.vy -= (y *= yd / l * strength) * m
                            data.vy += y * (1 - m)
                        }
                    }
                }

                return x0 > xi + xSize || y0 > yi + ySize ||
                    x1 < xi - xSize || y1 < yi - ySize
            }

            function prepare(quad) {
                if (quad.data) {
                    quad.size = sizes[quad.data.index]
                } else {
                    quad.size = [0, 0]
                    var i = -1
                    while (++i < 4) {
                        if (quad[i] && quad[i].size) {
                            quad.size[0] = Math.max(quad.size[0], quad[i].size[0])
                            quad.size[1] = Math.max(quad.size[1], quad[i].size[1])
                        }
                    }
                }
            }
        }

        function xCenter(d) { return d.x + d.vx + sizes[d.index][0] / 2 }
        function yCenter(d) { return d.y + d.vy + sizes[d.index][1] / 2 }

        force.initialize = function (_) {
            sizes = (nodes = _).map(size)
            masses = sizes.map(function (d) { return d[0] * d[1] })
        }

        force.size = function (_) {
            return (arguments.length
                ? (size = typeof _ === 'function' ? _ : constant(_), force)
                : size)
        }

        force.strength = function (_) {
            return (arguments.length ? (strength = +_, force) : strength)
        }

        force.iterations = function (_) {
            return (arguments.length ? (iterations = +_, force) : iterations)
        }

        return force
    }
    function constant(_) {
        return function () { return _ }
    }
}
