from typing import Dict, List, Any

def graphdata(
        adjacency_list: Dict[str, Any], 
        groupname: List[str] = []
    ):
    
    elements = {
        "nodes":[],
        "edges":[]
    }

    for node in adjacency_list:
        data = {
            "data": {
                "id": node, 
                "label": node,
            }
        }
        parent = adjacency_list[node][1]
        if len(parent) > 0:
            data["data"]["parent"] = parent
        elements["nodes"].append(data)

        for neighbor in adjacency_list[node][0]:
            elements["edges"].append({
                "data": {
                    "source": node, 
                    "target": neighbor
                }
            })

    g = 0
    for group in groupname:
        elements["nodes"].append({
            "data": {
                "id": group,
                "label": group
            }
        })
        g += 1
        
        return elements

if __name__ == '__main__':

    # input
    adjacency_list = {
        "A": (["B", "C", "z"], "Uppercase"),
        "B": (["A", "C"], "Uppercase"),
        "C": (["A", "B"], "Uppercase"),
        "D": (["A", "B"], "Uppercase"),
        "u": ([], ""),
        "s": (["z"], ""),
        "z": (["u"], "")
    }
    groupname = [
        "Uppercase"
    ]

    print(graphdata(adjacency_list, groupname))