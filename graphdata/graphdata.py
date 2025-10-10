import flask # only to test if dependencies are reachable

adjacency_list = {
    "A": ["B", "C"],
    "B": ["A", "C"],
    "C": ["A", "B"],
    "D": ["A", "B"],
}

elements = {
    "nodes":[],
    "edges":[]
}

for node in adjacency_list:
    elements["nodes"].append({
        "data": {
            "id": node, 
            "label": node
        }
    })
    for neighbor in adjacency_list[node]:
        elements["edges"].append({
            "data": {
                "source": node, 
                "target": neighbor
            }
        })

if __name__ == '__main__':
    nodes_list = elements["nodes"]
    edges_list = elements["edges"]
    combined_list = nodes_list + edges_list

    response_data = {"elements": combined_list}
    print(str(response_data).strip())