
// Define year
var year = 2019; 
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
                                          .mode().clip(districtCollection);


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
  'projects/ee-mudeledimeji/assets/postdoc/deforestation_mdg_paper/rasters/from_glc_landcover/FROM_GLC_yearImg_2019'
  ).clip(districtCollection);

var from_glc_image_trees = from_glc_image.eq(2);

var from_glc_image_trees_30m = from_glc_image_trees
  .reproject({
    crs: crs,
    scale: 30
  });

from_glc_image_trees_30m = from_glc_image_trees_30m.unmask(0).rename("mask");
print("FROM_GLC data", from_glc_image_trees_30m);

// Create PALSAR tree class layer 

var palsar_image = ee.ImageCollection("JAXA/ALOS/PALSAR/YEARLY/FNF4").filterDate(start_date, end_date)
                              .filterBounds(roi).select(["fnf"]).first().clip(districtCollection);

var palsar_image_trees = palsar_image.eq(1);

var palsar_image_trees_30m = palsar_image_trees
  .reproject({
    crs: crs,
    scale: 30
  });

palsar_image_trees_30m = palsar_image_trees_30m.unmask(0).rename("mask");

print("PALSAR data", palsar_image_trees_30m);


// Create ESRI tree class layer 

var esri_image = ee.Image(
  'projects/ee-mudeledimeji/assets/postdoc/deforestation_mdg_paper/rasters/esri_landcover/esri_mdg_2019'
  ).clip(districtCollection);

var esri_image_image_trees = esri_image.eq(2);

var esri_image_image_trees_30m = esri_image_image_trees
  .reproject({
    crs: crs,
    scale: 30
  });

esri_image_image_trees_30m = esri_image_image_trees_30m.unmask(0).rename("mask");
print("ESRI data", esri_image_image_trees_30m);

// Create Copernicus - CGLS tree class layer 

var cgls_image = ee.ImageCollection("COPERNICUS/Landcover/100m/Proba-V-C3/Global")
                                .select(["discrete_classification"])
                                .filterBounds(roi)
                                .filterDate(start_date, end_date)
                                .first()
                                .clip(districtCollection);
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
                    .clip(districtCollection);
var gfc_image = ee.Image("UMD/hansen/global_forest_change_2023_v1_11").select("lossyear").clip(districtCollection);

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
  .add(mf_gfc_image_30m.gt(0))
  .add(esri_image_image_trees_30m.gt(0));


var fromValues = [0, 1, 2, 3, 4, 5, 6];
var toValues = [0, 1, 1, 2, 2, 3, 3];

// Use the remap function to reclassify the image
var reclassified_agreement_map = countImagesWithOne.remap(fromValues, toValues);

var total_forest_from_all = countImagesWithOne.gt(0);

var total_area = total_forest_from_all.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi, // define your geometry here
  scale: 30, // set the scale according to your data
  maxPixels: 1e13
}).values().get(0);


var area_low_agreement = reclassified_agreement_map.eq(1).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi, // define your geometry here
  scale: 30,
  maxPixels: 1e13
}).values().get(0);

var area_medium_agreement = reclassified_agreement_map.eq(2).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi, // define your geometry here
  scale: 30,
  maxPixels: 1e13
}).values().get(0);

var area_high_agreement = reclassified_agreement_map.eq(3).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi, // define your geometry here
  scale: 30,
  maxPixels: 1e13
}).values().get(0);


var proportion_low_agreement = ee.Number(area_low_agreement).divide(total_area);
var proportion_medium_agreement = ee.Number(area_medium_agreement).divide(total_area);
var proportion_high_agreement = ee.Number(area_high_agreement).divide(total_area);

// Create features for each proportion
var feature_low = ee.Feature(null, {proportion: proportion_low_agreement, agreement: 'low'});
var feature_medium = ee.Feature(null, {proportion: proportion_medium_agreement, agreement: 'medium'});
var feature_high = ee.Feature(null, {proportion: proportion_high_agreement, agreement: 'high'});

// Create a feature collection
var feature_all_proportion = ee.FeatureCollection([feature_low, feature_medium, feature_high]);
// Export the FeatureCollection as a CSV to Google Drive

Export.table.toDrive({
  collection: feature_all_proportion,
  description: 'agreement_proportion_values_2019',
  folder: 'madagascar_deforestation_paper',
  fileFormat: 'CSV'
});
