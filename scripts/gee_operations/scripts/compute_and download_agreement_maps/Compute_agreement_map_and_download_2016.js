
/*
THIS NOTEBOOK CONTAINS JAVASCRIPT CODE TO COMPUTE AGREEMENT MAPS FOR MADAGASCAR
*/



// Define year
var year = 2016; 
var crs = "EPSG:4326";

print("Year: ", year);

var start_date = ee.Date.fromYMD(year, 1, 1);
var end_date = ee.Date.fromYMD(year+1, 1, 1);

//Load Madagascar district collections

var districtCollection = ee.FeatureCollection(
  'projects/ee-mudeledimeji/assets/postdoc/deforestation_mdg_paper/vectors/madagascar_districts');
// Now you can use districtCollection in your code, for example:
var roi = districtCollection.geometry().bounds();
Map.centerObject(roi, 6);


///////////////////////////////////////////
// CREATE ALL IMAGE LAYERS FOR THE YEAR
///////////////////////////////////////////


// Create DW tree class layer
var dynamic_world_image  = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                                          .filterBounds(roi).select(["label"])
                                          .filterDate(start_date, end_date)
                                          .mode().clip(roi);


var dynamic_world_image_tree = dynamic_world_image.eq(1);


var dynamic_world_image_tree_30m = dynamic_world_image_tree
  .reproject({
    crs: crs, // Use the projection of the image
    scale: 30 // Set the desired scale to 30m
  });
  
dynamic_world_image_tree_30m = dynamic_world_image_tree_30m.unmask(0).rename("mask");

print("DW data", dynamic_world_image_tree_30m);

// Create FROM_GLC tree class layer 

var from_glc_image = ee.Image(
  'projects/ee-mudeledimeji/assets/postdoc/deforestation_mdg_paper/rasters/from_glc_landcover/FROM_GLC_yearImg_2016'
  ).clip(roi);

var from_glc_image_trees = from_glc_image.eq(2);

var from_glc_image_trees_30m = from_glc_image_trees
  .reproject({
    crs: crs,
    scale: 30
  });

from_glc_image_trees_30m = from_glc_image_trees_30m.unmask(0).rename("mask");
print("FROM_GLC data", from_glc_image_trees_30m);

// Create PALSAR tree class layer 

var palsar_image = ee.ImageCollection("JAXA/ALOS/PALSAR/YEARLY/FNF").filterDate(start_date, end_date)
                              .filterBounds(roi).select(["fnf"]).first().clip(roi);

var palsar_image_trees = palsar_image.eq(1);

var palsar_image_trees_30m = palsar_image_trees
  .reproject({
    crs: crs,
    scale: 30
  });

palsar_image_trees_30m = palsar_image_trees_30m.unmask(0).rename("mask");
print("PALSAR data", palsar_image_trees_30m);

// Create Copernicus - CGLS tree class layer 

var cgls_image = ee.ImageCollection("COPERNICUS/Landcover/100m/Proba-V-C3/Global")
                                .select(["discrete_classification"])
                                .filterBounds(roi)
                                .filterDate(start_date, end_date)
                                .first()
                                .clip(roi);
var top_class_value = 126;
var bottom_class_value = 111;

var cgls_image_trees = cgls_image.lte(top_class_value).and(cgls_image.gte(bottom_class_value));

var cgls_image_trees_30m = cgls_image_trees
  .reproject({
    crs: crs,
    scale: 30
  });

cgls_image_trees_30m = cgls_image_trees_30m.unmask(0).rename("mask");
print("CGLS data", cgls_image_trees_30m);

// Create MF-GFC tree class layer

var mf_2000_image = ee.Image("projects/ee-mudeledimeji/assets/postdoc/deforestation_mdg_paper/rasters/harper_vielledent_2000")
                    .clip(roi);
var gfc_image = ee.Image("UMD/hansen/global_forest_change_2023_v1_11").select("lossyear").clip(roi);

var gfc_image_loss_curr_year = gfc_image.gt(0).and(gfc_image.lte(year - 2000));

var mf_2000_image_30m = mf_2000_image
  .reproject({
    crs: crs,
    scale: 30
  });

var gfc_image_loss_curr_year_30m = gfc_image_loss_curr_year
  .reproject({
    crs: crs,
    scale: 30
  });
  

var mf_gfc_image_30m = mf_2000_image_30m.where(gfc_image_loss_curr_year_30m.eq(1), 0);

mf_gfc_image_30m = mf_gfc_image_30m.unmask(0).rename("mask");
print("MF-GFC data", mf_gfc_image_30m);

///////////////////////////////////////////
// SUM ALL IMAGES TOGETHER TO OBTAIN AGREEMENT COUNT FOR EACH PIXEL
///////////////////////////////////////////

var countImagesWithOne = ee.Image.constant(0)
  .add(dynamic_world_image_tree_30m.gt(0))
  .add(palsar_image_trees_30m.gt(0))
  .add(from_glc_image_trees_30m.gt(0))
  .add(cgls_image_trees_30m.gt(0))
  .add(mf_gfc_image_30m.gt(0));
  
var fromValues = [0, 1, 2, 3, 4, 5,];
var toValues = [0, 1, 1, 2, 3, 3];

// Use the remap function to reclassify the image
var reclassified_agreement_map = countImagesWithOne.remap(fromValues, toValues);

Export.image.toDrive({
  image: reclassified_agreement_map,
  description: "agreement_map_2016_30m", // Get the export name as a plain JavaScript string
  folder: 'madagascar_deforestation_paper',
  scale: 30,
  region: roi,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});


