$downloads = Join-Path $env:USERPROFILE "Downloads"

function Copy-FirstMatch($pattern, $destination) {
    $match = Get-ChildItem -Path $downloads -Filter $pattern | Select-Object -First 1
    if ($match) {
        Copy-Item -Path $match.FullName -Destination $destination -Force
        Write-Host "Copied $($match.Name) -> $destination"
    } else {
        Write-Host "No match for $pattern"
    }
}

Copy-FirstMatch "*Dragon Rigged*.glb" "public\assets\models\bosses\dragon.glb"
Copy-FirstMatch "*Giant by Quaternius*.glb" "public\assets\models\bosses\giant.glb"
Copy-FirstMatch "*Yeti by Quaternius*.glb" "public\assets\models\bosses\yeti.glb"
Copy-FirstMatch "*Goblin by Quaternius*.glb" "public\assets\models\mobs\goblin.glb"
Copy-FirstMatch "*Skeleton by Quaternius*.glb" "public\assets\models\mobs\skeleton.glb"
Copy-FirstMatch "*Ghost Skull*.glb" "public\assets\models\mobs\ghost_skull.glb"
Copy-FirstMatch "*Ghost by Quaternius*.glb" "public\assets\models\mobs\ghost.glb"
Copy-FirstMatch "*Goleling Evolved*.glb" "public\assets\models\mobs\golem.glb"
Copy-FirstMatch "*Big arm*.glb" "public\assets\models\mobs\brute.glb"

# Unzip weapons from PACK
$weaponsZip = "PACK\PP_FreeFantasyRPGWeapons_FBX_files.zip"
if (Test-Path $weaponsZip) {
    Expand-Archive -Path $weaponsZip -DestinationPath "public\assets\models\weapons" -Force
    Write-Host "Extracted weapons pack"
}

# Extract Nature Pack
tar -xf "PACK\NaturePack_COLLADA.rar" -C "public\assets\models\nature"
Write-Host "Extracted Nature Pack"

# Copy FBX characters from PACK
Copy-Item "PACK\stoneRIGGED.fbx" "public\assets\models\mobs\stone_golem.fbx" -Force
Copy-Item "PACK\KnightNORUG.fbx" "public\assets\models\mobs\dark_knight.fbx" -Force
Copy-Item "PACK\DwarfRIGGED.fbx" "public\assets\models\mobs\dwarf.fbx" -Force
Copy-Item "PACK\MarketPack.fbx" "public\assets\models\props\market.fbx" -Force
Write-Host "Copied character and prop FBX files"

Get-ChildItem -Recurse "public\assets\models" | Select-Object Name, Length | Format-Table -AutoSize
